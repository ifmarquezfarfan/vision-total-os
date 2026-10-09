-- Share a reduced customer-facing view of a quotation using a high-entropy,
-- expiring token. It never exposes client identity, internal notes, costs or IDs.
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
    'total', q.total,
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

REVOKE ALL ON FUNCTION public.get_shared_quote(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_shared_quote(text) TO anon, authenticated;
