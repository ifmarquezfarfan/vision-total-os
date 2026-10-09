-- Keep optical use and per-eye selected coatings on the production order.
ALTER TABLE public.optical_orders
  ADD COLUMN IF NOT EXISTS lens_usage text,
  ADD COLUMN IF NOT EXISTS right_lens_coatings text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS left_lens_coatings text[] NOT NULL DEFAULT '{}';
