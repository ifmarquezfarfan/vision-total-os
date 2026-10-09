-- Atomic transitions for the customer-first optical sales flow.
-- These functions preserve the order: initial quote -> external measurement -> final quote -> sale/payment.

DROP FUNCTION IF EXISTS public.create_final_quote_transaction(uuid,numeric,timestamptz,text,jsonb);

CREATE OR REPLACE FUNCTION public.create_final_quote_transaction(target_parent uuid, target_discount numeric, target_expires_at timestamp with time zone, target_notes text, items jsonb, target_configuration jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  parent public.quotes%rowtype;
  created json;
  new_quote uuid;
BEGIN
  SELECT * INTO parent FROM public.quotes WHERE id = target_parent FOR UPDATE;
  IF parent.id IS NULL THEN RAISE EXCEPTION 'Initial quote not found'; END IF;
  IF parent.client_id IS NULL THEN RAISE EXCEPTION 'Client is required'; END IF;
  IF parent.workflow_stage <> 'measurement_received'
    OR parent.measurement_status <> 'received'
    OR parent.prescription_id IS NULL THEN
    RAISE EXCEPTION 'Measurement is required before the final quote';
  END IF;
  IF parent.quote_kind <> 'initial' THEN RAISE EXCEPTION 'Parent quote must be an initial quote'; END IF;
  IF NOT private.has_permission(parent.organization_id,parent.branch_id,'sales.create') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.quotes q WHERE q.parent_quote_id = parent.id AND q.quote_kind = 'final'
      AND q.status NOT IN ('cancelled','rejected','expired')
  ) THEN RAISE EXCEPTION 'A final quote already exists for this initial quote'; END IF;

  created := private.create_quote_transaction(
    parent.organization_id,parent.branch_id,parent.client_id,parent.lead_id,
    greatest(coalesce(target_discount,0),0),target_expires_at,
    coalesce(nullif(target_notes,''),parent.notes),items
  );
  new_quote := (created->>'quote_id')::uuid;

  UPDATE public.quotes
  SET quote_kind='final',workflow_stage='final_quote',
      requires_measurement=true,measurement_status='received',
      measurement_provider=parent.measurement_provider,
      measurement_sent_at=parent.measurement_sent_at,
      measurement_received_at=parent.measurement_received_at,
      measurement_notes=parent.measurement_notes,prescription_id=parent.prescription_id,
      parent_quote_id=parent.id,
      optical_configuration=coalesce(parent.optical_configuration,'{}'::jsonb) || coalesce(target_configuration,'{}'::jsonb),
      finalized_at=now(),updated_at=now()
  WHERE id=new_quote;

  RETURN created::jsonb || jsonb_build_object('parent_quote_id',parent.id,'workflow_stage','final_quote');
END;
$function$


CREATE OR REPLACE FUNCTION public.receive_quote_measurement(target_quote uuid, rx jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  q public.quotes%rowtype; new_prescription uuid;
  v_od_axis numeric; v_os_axis numeric; v_od_near_axis numeric; v_os_near_axis numeric;
  v_pd numeric; v_pd_od numeric; v_pd_os numeric;
  v_od_ph numeric; v_od_pv numeric; v_os_ph numeric; v_os_pv numeric;
  v_od_ph_base text; v_od_pv_base text; v_os_ph_base text; v_os_pv_base text;
BEGIN
  SELECT * INTO q FROM public.quotes WHERE id = target_quote FOR UPDATE;
  IF q.id IS NULL THEN RAISE EXCEPTION 'Quote not found'; END IF;
  IF q.client_id IS NULL THEN RAISE EXCEPTION 'Client is required'; END IF;
  IF q.workflow_stage <> 'measurement_pending' OR q.measurement_status <> 'pending' THEN RAISE EXCEPTION 'Quote is not waiting for measurement'; END IF;
  IF NOT private.has_permission(q.organization_id,q.branch_id,'sales.update')
     OR NOT private.has_permission(q.organization_id,q.branch_id,'prescriptions.create') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF jsonb_typeof(rx) <> 'object' THEN RAISE EXCEPTION 'Invalid prescription payload'; END IF;

  v_od_axis := nullif(rx->>'od_axis','')::numeric;
  v_os_axis := nullif(rx->>'os_axis','')::numeric;
  v_od_near_axis := nullif(rx->>'od_near_axis','')::numeric;
  v_os_near_axis := nullif(rx->>'os_near_axis','')::numeric;
  IF (v_od_axis IS NOT NULL AND (v_od_axis < 1 OR v_od_axis > 180 OR v_od_axis <> trunc(v_od_axis)))
    OR (v_os_axis IS NOT NULL AND (v_os_axis < 1 OR v_os_axis > 180 OR v_os_axis <> trunc(v_os_axis)))
    OR (v_od_near_axis IS NOT NULL AND (v_od_near_axis < 1 OR v_od_near_axis > 180 OR v_od_near_axis <> trunc(v_od_near_axis)))
    OR (v_os_near_axis IS NOT NULL AND (v_os_near_axis < 1 OR v_os_near_axis > 180 OR v_os_near_axis <> trunc(v_os_near_axis))) THEN
    RAISE EXCEPTION 'Axis must be between 1 and 180';
  END IF;

  v_pd := nullif(rx->>'pd','')::numeric;
  v_pd_od := nullif(rx->>'pd_od','')::numeric;
  v_pd_os := nullif(rx->>'pd_os','')::numeric;
  IF (v_pd IS NOT NULL AND (v_pd <= 0 OR v_pd > 100))
    OR (v_pd_od IS NOT NULL AND (v_pd_od <= 0 OR v_pd_od > 50))
    OR (v_pd_os IS NOT NULL AND (v_pd_os <= 0 OR v_pd_os > 50)) THEN RAISE EXCEPTION 'Invalid pupillary distance'; END IF;

  v_od_ph := nullif(rx->>'od_prism_horizontal','')::numeric;
  v_od_pv := nullif(rx->>'od_prism_vertical','')::numeric;
  v_os_ph := nullif(rx->>'os_prism_horizontal','')::numeric;
  v_os_pv := nullif(rx->>'os_prism_vertical','')::numeric;
  v_od_ph_base := nullif(rx->>'od_prism_horizontal_base','');
  v_od_pv_base := nullif(rx->>'od_prism_vertical_base','');
  v_os_ph_base := nullif(rx->>'os_prism_horizontal_base','');
  v_os_pv_base := nullif(rx->>'os_prism_vertical_base','');
  IF (v_od_ph IS NOT NULL AND v_od_ph < 0) OR (v_od_pv IS NOT NULL AND v_od_pv < 0)
    OR (v_os_ph IS NOT NULL AND v_os_ph < 0) OR (v_os_pv IS NOT NULL AND v_os_pv < 0) THEN RAISE EXCEPTION 'Prism cannot be negative'; END IF;
  IF (v_od_ph > 0 AND coalesce(v_od_ph_base,'') NOT IN ('BI','BO'))
    OR (v_os_ph > 0 AND coalesce(v_os_ph_base,'') NOT IN ('BI','BO'))
    OR (v_od_pv > 0 AND coalesce(v_od_pv_base,'') NOT IN ('BU','BD'))
    OR (v_os_pv > 0 AND coalesce(v_os_pv_base,'') NOT IN ('BU','BD'))
    OR (v_od_ph_base IS NOT NULL AND v_od_ph_base NOT IN ('BI','BO'))
    OR (v_os_ph_base IS NOT NULL AND v_os_ph_base NOT IN ('BI','BO'))
    OR (v_od_pv_base IS NOT NULL AND v_od_pv_base NOT IN ('BU','BD'))
    OR (v_os_pv_base IS NOT NULL AND v_os_pv_base NOT IN ('BU','BD')) THEN RAISE EXCEPTION 'Prism base is required or invalid'; END IF;

  IF nullif(rx->>'cylinder_notation','') NOT IN ('positive','negative') THEN RAISE EXCEPTION 'Invalid cylinder notation'; END IF;
  IF nullif(rx->>'rx_type','') IS NULL THEN RAISE EXCEPTION 'Prescription type is required'; END IF;
  IF nullif(rx->>'od_sphere','') IS NULL AND nullif(rx->>'od_cylinder','') IS NULL
    AND nullif(rx->>'os_sphere','') IS NULL AND nullif(rx->>'os_cylinder','') IS NULL
    AND nullif(rx->>'od_near_sphere','') IS NULL AND nullif(rx->>'os_near_sphere','') IS NULL THEN
    RAISE EXCEPTION 'At least one prescription power is required';
  END IF;

  INSERT INTO public.prescriptions (
    organization_id,branch_id,client_id,exam_at,expires_at,rx_type,cylinder_notation,prescriber_name,prescriber_license,rx_source,
    od_sphere,od_cylinder,od_axis,od_add,os_sphere,os_cylinder,os_axis,os_add,
    od_near_sphere,od_near_cylinder,od_near_axis,os_near_sphere,os_near_cylinder,os_near_axis,
    od_prism_horizontal,od_prism_horizontal_base,od_prism_vertical,od_prism_vertical_base,
    os_prism_horizontal,os_prism_horizontal_base,os_prism_vertical,os_prism_vertical_base,pd,pd_od,pd_os,notes,created_by
  ) VALUES (
    q.organization_id,q.branch_id,q.client_id,
    coalesce(nullif(rx->>'exam_at','')::timestamptz,now()),nullif(rx->>'expires_at','')::timestamptz,
    nullif(rx->>'rx_type',''),nullif(rx->>'cylinder_notation',''),nullif(rx->>'prescriber_name',''),nullif(rx->>'prescriber_license',''),
    coalesce(nullif(rx->>'rx_source',''),'Medición externa'),
    nullif(rx->>'od_sphere','')::numeric,nullif(rx->>'od_cylinder','')::numeric,v_od_axis,nullif(rx->>'od_add','')::numeric,
    nullif(rx->>'os_sphere','')::numeric,nullif(rx->>'os_cylinder','')::numeric,v_os_axis,nullif(rx->>'os_add','')::numeric,
    nullif(rx->>'od_near_sphere','')::numeric,nullif(rx->>'od_near_cylinder','')::numeric,v_od_near_axis,
    nullif(rx->>'os_near_sphere','')::numeric,nullif(rx->>'os_near_cylinder','')::numeric,v_os_near_axis,
    v_od_ph,v_od_ph_base,v_od_pv,v_od_pv_base,v_os_ph,v_os_ph_base,v_os_pv,v_os_pv_base,
    v_pd,v_pd_od,v_pd_os,nullif(rx->>'prescription_notes',''),auth.uid()
  ) RETURNING id INTO new_prescription;

  UPDATE public.quotes SET workflow_stage='measurement_received',measurement_status='received',measurement_received_at=now(),
    measurement_notes=coalesce(nullif(rx->>'measurement_notes',''),measurement_notes),prescription_id=new_prescription,updated_at=now()
  WHERE id=q.id;
  RETURN jsonb_build_object('quote_id',q.id,'prescription_id',new_prescription,'workflow_stage','measurement_received');
END;
$function$


REVOKE ALL ON FUNCTION public.receive_quote_measurement(uuid,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.receive_quote_measurement(uuid,jsonb) TO authenticated;

REVOKE ALL ON FUNCTION public.create_final_quote_transaction(uuid,numeric,timestamptz,text,jsonb,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_final_quote_transaction(uuid,numeric,timestamptz,text,jsonb,jsonb) TO authenticated;
