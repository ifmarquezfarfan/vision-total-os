-- Final quote sharing is generated inside the transaction to avoid a half-published quote.
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
      share_token=CASE WHEN coalesce((target_configuration->>'share_final_quote')::boolean,false) THEN encode(gen_random_bytes(24),'hex') ELSE NULL END,
      share_enabled=coalesce((target_configuration->>'share_final_quote')::boolean,false),
      share_expires_at=CASE WHEN coalesce((target_configuration->>'share_final_quote')::boolean,false) THEN now()+interval '14 days' ELSE NULL END,
      finalized_at=now(),updated_at=now()
  WHERE id=new_quote;

  RETURN created::jsonb || jsonb_build_object(
    'parent_quote_id',parent.id,
    'workflow_stage','final_quote',
    'share_token',(SELECT q.share_token FROM public.quotes q WHERE q.id=new_quote)
  );
END;
$function$
;
REVOKE ALL ON FUNCTION public.create_final_quote_transaction(uuid,numeric,timestamptz,text,jsonb,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_final_quote_transaction(uuid,numeric,timestamptz,text,jsonb,jsonb) TO authenticated;
