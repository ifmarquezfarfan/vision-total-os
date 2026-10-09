ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS share_token text,
  ADD COLUMN IF NOT EXISTS share_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS share_expires_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS quotes_share_token_unique
  ON public.quotes(share_token)
  WHERE share_token IS NOT NULL;

CREATE OR REPLACE FUNCTION public.get_shared_quote(target_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  q public.quotes%rowtype;
  result jsonb;
BEGIN
  IF target_token IS NULL OR length(target_token) < 30 OR length(target_token) > 100 THEN
    RETURN NULL;
  END IF;

  SELECT * INTO q
  FROM public.quotes
  WHERE share_token = target_token
    AND share_enabled = true
    AND (share_expires_at IS NULL OR share_expires_at > now())
    AND status NOT IN ('cancelled','rejected','expired')
  LIMIT 1;

  IF q.id IS NULL THEN RETURN NULL; END IF;

  SELECT jsonb_build_object(
    'quote', jsonb_build_object(
      'quote_code',q.quote_code,'quote_at',q.quote_at,'expires_at',q.expires_at,
      'subtotal',q.subtotal,'discount',q.discount,'total',q.total,'status',q.status,
      'quote_kind',q.quote_kind,'workflow_stage',q.workflow_stage,
      'requires_measurement',q.requires_measurement,'measurement_status',q.measurement_status,
      'branch_label',b.name
    ),
    'items',COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'description',qi.description,'component_type',qi.component_type,'quantity',qi.quantity,
        'unit_price',qi.unit_price,'discount',qi.discount,'line_total',qi.line_total
      ) ORDER BY qi.id)
      FROM public.quote_items qi WHERE qi.quote_id=q.id
    ),'[]'::jsonb),
    'optical_configuration',jsonb_build_object(
      'usage',q.optical_configuration->>'usage',
      'od',CASE WHEN q.optical_configuration->'od' IS NOT NULL THEN jsonb_strip_nulls(jsonb_build_object(
        'product_code',q.optical_configuration->'od'->>'product_code',
        'brand',q.optical_configuration->'od'->>'brand','model',q.optical_configuration->'od'->>'model',
        'design',q.optical_configuration->'od'->>'design','material',q.optical_configuration->'od'->>'material',
        'index',q.optical_configuration->'od'->>'index','phi_mm',q.optical_configuration->'od'->>'phi_mm',
        'coatings',q.optical_configuration->'od'->'coatings',
        'catalog_sale_price',q.optical_configuration->'od'->>'catalog_sale_price'
      )) ELSE NULL END,
      'oi',CASE WHEN q.optical_configuration->'oi' IS NOT NULL THEN jsonb_strip_nulls(jsonb_build_object(
        'product_code',q.optical_configuration->'oi'->>'product_code',
        'brand',q.optical_configuration->'oi'->>'brand','model',q.optical_configuration->'oi'->>'model',
        'design',q.optical_configuration->'oi'->>'design','material',q.optical_configuration->'oi'->>'material',
        'index',q.optical_configuration->'oi'->>'index','phi_mm',q.optical_configuration->'oi'->>'phi_mm',
        'coatings',q.optical_configuration->'oi'->'coatings',
        'catalog_sale_price',q.optical_configuration->'oi'->>'catalog_sale_price'
      )) ELSE NULL END
    )
  )
  INTO result
  FROM public.branches b
  WHERE b.id=q.branch_id AND b.organization_id=q.organization_id;

  RETURN result;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_shared_quote(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_shared_quote(text) TO anon, authenticated;
