-- The optical sales journey starts with an initial quote, then an external measurement,
-- final configuration, and only then sale/payment. Existing rows stay valid.
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS workflow_stage text NOT NULL DEFAULT 'initial_quote',
  ADD COLUMN IF NOT EXISTS quote_kind text NOT NULL DEFAULT 'initial',
  ADD COLUMN IF NOT EXISTS requires_measurement boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS measurement_status text NOT NULL DEFAULT 'not_started',
  ADD COLUMN IF NOT EXISTS measurement_provider text,
  ADD COLUMN IF NOT EXISTS measurement_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS measurement_received_at timestamptz,
  ADD COLUMN IF NOT EXISTS measurement_notes text,
  ADD COLUMN IF NOT EXISTS prescription_id uuid,
  ADD COLUMN IF NOT EXISTS parent_quote_id uuid,
  ADD COLUMN IF NOT EXISTS finalized_at timestamptz;

UPDATE public.quotes
SET workflow_stage = CASE WHEN status = 'converted' OR sale_id IS NOT NULL THEN 'sale_completed' ELSE workflow_stage END,
    measurement_status = CASE WHEN requires_measurement = false THEN 'not_required' ELSE measurement_status END;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quotes_prescription_id_fkey') THEN
    ALTER TABLE public.quotes ADD CONSTRAINT quotes_prescription_id_fkey
      FOREIGN KEY (prescription_id) REFERENCES public.prescriptions(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quotes_parent_quote_id_fkey') THEN
    ALTER TABLE public.quotes ADD CONSTRAINT quotes_parent_quote_id_fkey
      FOREIGN KEY (parent_quote_id) REFERENCES public.quotes(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quotes_workflow_stage_check') THEN
    ALTER TABLE public.quotes ADD CONSTRAINT quotes_workflow_stage_check
      CHECK (workflow_stage IN ('initial_quote','measurement_pending','measurement_received','final_quote','sale_completed','cancelled'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quotes_quote_kind_check') THEN
    ALTER TABLE public.quotes ADD CONSTRAINT quotes_quote_kind_check
      CHECK (quote_kind IN ('initial','final'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quotes_measurement_status_check') THEN
    ALTER TABLE public.quotes ADD CONSTRAINT quotes_measurement_status_check
      CHECK (measurement_status IN ('not_started','pending','received','not_required'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS quotes_workflow_queue_idx
  ON public.quotes (organization_id, branch_id, workflow_stage, quote_at DESC);

CREATE OR REPLACE FUNCTION private.record_quote_measurement(target_quote uuid, target_data jsonb)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  q public.quotes%rowtype;
  rx_id uuid;
  od_axis_value numeric;
  os_axis_value numeric;
  od_near_axis_value numeric;
  os_near_axis_value numeric;
  pd_value numeric;
  pd_od_value numeric;
  pd_os_value numeric;
BEGIN
  SELECT * INTO q FROM public.quotes WHERE id = target_quote FOR UPDATE;
  IF q.id IS NULL THEN RAISE EXCEPTION 'Quote not found'; END IF;
  IF NOT private.has_permission(q.organization_id, q.branch_id, 'sales.create') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF q.workflow_stage <> 'measurement_pending' OR q.measurement_status <> 'pending' THEN RAISE EXCEPTION 'Quote is not awaiting measurements'; END IF;
  IF q.client_id IS NULL THEN RAISE EXCEPTION 'Quote client is required'; END IF;

  od_axis_value := NULLIF(target_data->>'od_axis','')::numeric;
  os_axis_value := NULLIF(target_data->>'os_axis','')::numeric;
  od_near_axis_value := NULLIF(target_data->>'od_near_axis','')::numeric;
  os_near_axis_value := NULLIF(target_data->>'os_near_axis','')::numeric;
  pd_value := NULLIF(target_data->>'pd','')::numeric;
  pd_od_value := NULLIF(target_data->>'pd_od','')::numeric;
  pd_os_value := NULLIF(target_data->>'pd_os','')::numeric;

  IF EXISTS (SELECT 1 FROM (VALUES (od_axis_value),(os_axis_value),(od_near_axis_value),(os_near_axis_value)) axes(value) WHERE value IS NOT NULL AND (value < 1 OR value > 180 OR value <> trunc(value))) THEN RAISE EXCEPTION 'Axis must be between 1 and 180'; END IF;
  IF EXISTS (SELECT 1 FROM (VALUES (pd_value),(pd_od_value),(pd_os_value)) pds(value) WHERE value IS NOT NULL AND (value <= 0 OR value > 100)) THEN RAISE EXCEPTION 'Invalid pupillary distance'; END IF;

  INSERT INTO public.prescriptions (
    organization_id, branch_id, client_id, exam_at, expires_at,
    rx_type, cylinder_notation, prescriber_name, prescriber_license, rx_source,
    od_sphere, od_cylinder, od_axis, od_add, os_sphere, os_cylinder, os_axis, os_add,
    od_near_sphere, od_near_cylinder, od_near_axis, os_near_sphere, os_near_cylinder, os_near_axis,
    od_prism_horizontal, od_prism_horizontal_base, od_prism_vertical, od_prism_vertical_base,
    os_prism_horizontal, os_prism_horizontal_base, os_prism_vertical, os_prism_vertical_base,
    pd, pd_od, pd_os, notes, created_by
  ) VALUES (
    q.organization_id, q.branch_id, q.client_id,
    COALESCE(NULLIF(target_data->>'exam_at','')::timestamptz, now()),
    NULLIF(target_data->>'expires_at','')::date,
    NULLIF(target_data->>'rx_type',''), COALESCE(NULLIF(target_data->>'cylinder_notation',''),'negative'),
    NULLIF(target_data->>'prescriber_name',''), NULLIF(target_data->>'prescriber_license',''),
    COALESCE(NULLIF(target_data->>'rx_source',''),'Medición externa'),
    NULLIF(target_data->>'od_sphere','')::numeric, NULLIF(target_data->>'od_cylinder','')::numeric, od_axis_value, NULLIF(target_data->>'od_add','')::numeric,
    NULLIF(target_data->>'os_sphere','')::numeric, NULLIF(target_data->>'os_cylinder','')::numeric, os_axis_value, NULLIF(target_data->>'os_add','')::numeric,
    NULLIF(target_data->>'od_near_sphere','')::numeric, NULLIF(target_data->>'od_near_cylinder','')::numeric, od_near_axis_value,
    NULLIF(target_data->>'os_near_sphere','')::numeric, NULLIF(target_data->>'os_near_cylinder','')::numeric, os_near_axis_value,
    NULLIF(target_data->>'od_prism_horizontal','')::numeric, NULLIF(target_data->>'od_prism_horizontal_base',''),
    NULLIF(target_data->>'od_prism_vertical','')::numeric, NULLIF(target_data->>'od_prism_vertical_base',''),
    NULLIF(target_data->>'os_prism_horizontal','')::numeric, NULLIF(target_data->>'os_prism_horizontal_base',''),
    NULLIF(target_data->>'os_prism_vertical','')::numeric, NULLIF(target_data->>'os_prism_vertical_base',''),
    pd_value, pd_od_value, pd_os_value, NULLIF(target_data->>'notes',''), auth.uid()
  ) RETURNING id INTO rx_id;

  UPDATE public.quotes
  SET prescription_id = rx_id, workflow_stage = 'measurement_received',
      measurement_status = 'received', measurement_received_at = now(),
      measurement_notes = COALESCE(NULLIF(target_data->>'measurement_notes',''), measurement_notes),
      updated_at = now()
  WHERE id = target_quote;

  RETURN json_build_object('quote_id', q.id, 'prescription_id', rx_id, 'workflow_stage', 'measurement_received');
END;
$function$;

CREATE OR REPLACE FUNCTION public.record_quote_measurement(target_quote uuid, target_data jsonb)
RETURNS json
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $function$
  SELECT private.record_quote_measurement($1, $2);
$function$;
