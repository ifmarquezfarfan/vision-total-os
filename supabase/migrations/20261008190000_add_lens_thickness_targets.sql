-- Optional thickness targets for lab-specific optical orders.
ALTER TABLE public.optical_orders
  ADD COLUMN IF NOT EXISTS lens_center_thickness_mm numeric,
  ADD COLUMN IF NOT EXISTS lens_edge_thickness_mm numeric;
