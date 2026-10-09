-- Include the customer-facing optical specification fields in private shared quote links.
-- Internal intake notes, customer priorities and budget references are intentionally excluded.

CREATE OR REPLACE FUNCTION public.get_shared_quote(target_token text)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT jsonb_build_object(
    'quote_code', q.quote_code,
    'quote_kind', q.quote_kind,
    'workflow_stage', q.workflow_stage,
    'status', q.status,
    'quote_at', q.quote_at,
    'expires_at', q.expires_at,
    'share_expires_at', q.share_expires_at,
    'subtotal', q.subtotal,
    'discount', q.discount,
    'total', q.total,
    'optical_configuration', jsonb_build_object(
      'lens_family', q.optical_configuration->'lens_family',
      'lens_material', q.optical_configuration->'lens_material',
      'lens_treatments', q.optical_configuration->'lens_treatments',
      'lens_series', q.optical_configuration->'lens_series',
      'package_brand', q.optical_configuration->'package_brand',
      'price_note', q.optical_configuration->'price_note',
      'intended_use', q.optical_configuration->'intended_use'
    ),
    'items', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'description', qi.description,
        'component_type', qi.component_type,
        'quantity', qi.quantity,
        'unit_price', qi.unit_price,
        'discount', qi.discount,
        'line_total', qi.line_total
      ))
      FROM public.quote_items qi
      WHERE qi.quote_id = q.id
    ), '[]'::jsonb)
  )
  FROM public.quotes q
  WHERE q.share_token = target_token
    AND q.share_enabled = true
    AND q.share_expires_at > now()
    AND (q.expires_at IS NULL OR q.expires_at > now())
    AND q.status NOT IN ('cancelled','rejected','expired','converted')
  LIMIT 1;
$function$;
