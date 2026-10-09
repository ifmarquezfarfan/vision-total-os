-- Reconcile legacy quotes that already reference a completed sale.
UPDATE public.quotes
SET status = 'converted',
    workflow_stage = 'sale_completed',
    quote_kind = 'final',
    requires_measurement = false,
    measurement_status = 'not_required',
    finalized_at = COALESCE(finalized_at, updated_at, now()),
    updated_at = now()
WHERE sale_id IS NOT NULL
  AND (status <> 'converted' OR workflow_stage <> 'sale_completed' OR quote_kind <> 'final' OR requires_measurement <> false);
