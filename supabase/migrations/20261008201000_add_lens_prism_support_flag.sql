-- Indicates whether a catalog lens product can be supplied with prism capability.
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS lens_prism_capable boolean NOT NULL DEFAULT false;
