-- Expand structured prescriptions and optical lens specifications.
-- Additive-only migration: existing prescription and order data stays intact.

ALTER TABLE public.prescriptions
  ADD COLUMN IF NOT EXISTS rx_type text,
  ADD COLUMN IF NOT EXISTS cylinder_notation text NOT NULL DEFAULT 'negative',
  ADD COLUMN IF NOT EXISTS prescriber_name text,
  ADD COLUMN IF NOT EXISTS prescriber_license text,
  ADD COLUMN IF NOT EXISTS rx_source text,
  ADD COLUMN IF NOT EXISTS pd_od numeric,
  ADD COLUMN IF NOT EXISTS pd_os numeric,
  ADD COLUMN IF NOT EXISTS od_near_sphere numeric,
  ADD COLUMN IF NOT EXISTS od_near_cylinder numeric,
  ADD COLUMN IF NOT EXISTS od_near_axis numeric,
  ADD COLUMN IF NOT EXISTS os_near_sphere numeric,
  ADD COLUMN IF NOT EXISTS os_near_cylinder numeric,
  ADD COLUMN IF NOT EXISTS os_near_axis numeric,
  ADD COLUMN IF NOT EXISTS od_prism_horizontal numeric,
  ADD COLUMN IF NOT EXISTS od_prism_horizontal_base text,
  ADD COLUMN IF NOT EXISTS od_prism_vertical numeric,
  ADD COLUMN IF NOT EXISTS od_prism_vertical_base text,
  ADD COLUMN IF NOT EXISTS os_prism_horizontal numeric,
  ADD COLUMN IF NOT EXISTS os_prism_horizontal_base text,
  ADD COLUMN IF NOT EXISTS os_prism_vertical numeric,
  ADD COLUMN IF NOT EXISTS os_prism_vertical_base text;

ALTER TABLE public.optical_orders
  ADD COLUMN IF NOT EXISTS lens_diameter_mm numeric,
  ADD COLUMN IF NOT EXISTS lens_tint_color text;
