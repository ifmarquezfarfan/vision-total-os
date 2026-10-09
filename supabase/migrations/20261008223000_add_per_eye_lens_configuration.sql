-- Store explicit lens choice per eye in the final quote and optical order.
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS optical_configuration jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.optical_orders
  ADD COLUMN IF NOT EXISTS right_lens_product_id uuid,
  ADD COLUMN IF NOT EXISTS left_lens_product_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='optical_orders_right_lens_product_id_fkey') THEN
    ALTER TABLE public.optical_orders ADD CONSTRAINT optical_orders_right_lens_product_id_fkey
      FOREIGN KEY (right_lens_product_id) REFERENCES public.products(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='optical_orders_left_lens_product_id_fkey') THEN
    ALTER TABLE public.optical_orders ADD CONSTRAINT optical_orders_left_lens_product_id_fkey
      FOREIGN KEY (left_lens_product_id) REFERENCES public.products(id) ON DELETE SET NULL;
  END IF;
END $$;
