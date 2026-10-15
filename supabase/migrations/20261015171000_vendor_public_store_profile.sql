-- Seller-controlled public storefront metadata; shipping origin remains private and separate.
ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS store_email text,
  ADD COLUMN IF NOT EXISTS primary_category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS additional_category_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS public_store_address jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS store_language text NOT NULL DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS contact_visibility text NOT NULL DEFAULT 'all';

ALTER TABLE public.vendors DROP CONSTRAINT IF EXISTS vendors_contact_visibility_check;
ALTER TABLE public.vendors ADD CONSTRAINT vendors_contact_visibility_check
 CHECK (contact_visibility IN ('all','email','phone','hidden'));
ALTER TABLE public.vendors DROP CONSTRAINT IF EXISTS vendors_store_language_check;
ALTER TABLE public.vendors ADD CONSTRAINT vendors_store_language_check
 CHECK (store_language IN ('en','fr'));
-- Existing vendor ownership RLS remains authoritative; do not grant new access here.
