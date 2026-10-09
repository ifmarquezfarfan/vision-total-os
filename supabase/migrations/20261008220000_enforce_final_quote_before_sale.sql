-- Preserve pre-workflow quotes so existing staff can continue converting them.
UPDATE public.quotes
SET workflow_stage = CASE WHEN status = 'converted' OR sale_id IS NOT NULL THEN 'sale_completed' ELSE 'final_quote' END,
    quote_kind = CASE WHEN status = 'converted' OR sale_id IS NOT NULL THEN quote_kind ELSE 'final' END,
    requires_measurement = CASE WHEN status = 'converted' OR sale_id IS NOT NULL THEN requires_measurement ELSE false END,
    measurement_status = CASE WHEN status = 'converted' OR sale_id IS NOT NULL THEN measurement_status ELSE 'not_required' END,
    finalized_at = CASE WHEN status = 'converted' OR sale_id IS NOT NULL THEN finalized_at ELSE COALESCE(finalized_at, now()) END
WHERE workflow_stage = 'initial_quote' AND measurement_status = 'not_started' AND created_at < now();

CREATE OR REPLACE FUNCTION private.convert_quote_to_sale_transaction(
  target_quote uuid, target_payment_method text, target_paid numeric, target_responsible text
) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE
  q public.quotes%rowtype;
  quote_items jsonb;
  result json;
BEGIN
  SELECT * INTO q FROM public.quotes WHERE id = target_quote FOR UPDATE;
  IF q.id IS NULL THEN RAISE EXCEPTION 'Quote not found'; END IF;
  IF q.status IN ('converted','cancelled','rejected') THEN RAISE EXCEPTION 'Quote cannot be converted'; END IF;
  IF q.workflow_stage <> 'final_quote' THEN RAISE EXCEPTION 'Quote workflow incomplete'; END IF;
  IF q.requires_measurement AND q.measurement_status <> 'received' THEN RAISE EXCEPTION 'Measurement required before sale'; END IF;
  IF NOT private.has_permission(q.organization_id,q.branch_id,'sales.create') THEN RAISE EXCEPTION 'Not authorized'; END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'product_id',product_id,'description',description,'component_type',component_type,
    'quantity',quantity,'unit_price',unit_price,'unit_cost',unit_cost,'discount',discount
  )),'[]'::jsonb)
  INTO quote_items FROM public.quote_items WHERE quote_id=q.id;

  result := private.create_sale_transaction(
    q.organization_id,q.branch_id,q.client_id,q.lead_id,target_payment_method,target_paid,q.discount,target_responsible,quote_items
  );

  UPDATE public.quotes SET status='converted',sale_id=(result->>'sale_id')::uuid,
    workflow_stage='sale_completed',finalized_at=COALESCE(finalized_at,now()),updated_at=now()
  WHERE id=q.id;

  RETURN result;
END;
$function$;
