-- Structured optical lens catalog fields used by the lens search engine.
-- All fields are additive and optional so current products keep working.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS lens_design text,
  ADD COLUMN IF NOT EXISTS lens_material text,
  ADD COLUMN IF NOT EXISTS lens_index numeric(4,2),
  ADD COLUMN IF NOT EXISTS lens_phi_mm numeric(6,2),
  ADD COLUMN IF NOT EXISTS lens_coatings text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS lens_sphere_min numeric(6,2),
  ADD COLUMN IF NOT EXISTS lens_sphere_max numeric(6,2),
  ADD COLUMN IF NOT EXISTS lens_cylinder_min numeric(6,2),
  ADD COLUMN IF NOT EXISTS lens_cylinder_max numeric(6,2);

ALTER TABLE public.optical_orders
  ADD COLUMN IF NOT EXISTS lens_product_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'optical_orders_lens_product_id_fkey') THEN
    ALTER TABLE public.optical_orders
      ADD CONSTRAINT optical_orders_lens_product_id_fkey
      FOREIGN KEY (lens_product_id) REFERENCES public.products(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_lens_index_range_check') THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_lens_index_range_check
      CHECK (lens_index IS NULL OR (lens_index >= 1 AND lens_index <= 2));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_lens_phi_range_check') THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_lens_phi_range_check
      CHECK (lens_phi_mm IS NULL OR (lens_phi_mm > 0 AND lens_phi_mm <= 120));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_lens_sphere_range_check') THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_lens_sphere_range_check
      CHECK (lens_sphere_min IS NULL OR lens_sphere_max IS NULL OR lens_sphere_min <= lens_sphere_max);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_lens_cylinder_range_check') THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_lens_cylinder_range_check
      CHECK (lens_cylinder_min IS NULL OR lens_cylinder_max IS NULL OR lens_cylinder_min <= lens_cylinder_max);
  END IF;
END $$;
