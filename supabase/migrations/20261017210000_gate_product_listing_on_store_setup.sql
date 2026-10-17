-- Product listing is denied until admin approval and mandatory store setup.
-- Enforced server-side for direct API requests as well as dashboard actions.
CREATE OR REPLACE FUNCTION public.barakaz_require_seller_store_setup()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE seller public.vendors%ROWTYPE;
BEGIN
 SELECT * INTO seller FROM public.vendors WHERE id = NEW.vendor_id;
 IF NOT FOUND OR seller.status IS DISTINCT FROM 'approved' THEN
  RAISE EXCEPTION 'Seller approval is required before listing products' USING ERRCODE = '23514';
 END IF;
 IF seller.store_name IS NULL
    OR btrim(seller.store_name) = ''
    OR seller.store_name LIKE 'Pending Store Setup %'
    OR nullif(btrim(coalesce(seller.store_description,'')), '') IS NULL
    OR nullif(btrim(coalesce(seller.phone,'')), '') IS NULL
    OR nullif(btrim(coalesce(seller.logo_url,'')), '') IS NULL
    OR nullif(btrim(coalesce(seller.banner_url,'')), '') IS NULL
    OR nullif(btrim(coalesce(seller.warehouse_address->>'street1','')), '') IS NULL
    OR nullif(btrim(coalesce(seller.warehouse_address->>'city','')), '') IS NULL
    OR nullif(btrim(coalesce(seller.warehouse_address->>'country','')), '') IS NULL
    OR nullif(btrim(coalesce(seller.warehouse_address->>'phone','')), '') IS NULL
    OR NOT EXISTS (SELECT 1 FROM jsonb_each_text(coalesce(seller.payment_details,'{}'::jsonb)) AS payment(key,value) WHERE nullif(btrim(payment.value),'') IS NOT NULL)
 THEN
  RAISE EXCEPTION 'Complete mandatory Store Settings before listing products' USING ERRCODE = '23514';
 END IF;
 RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS products_require_store_setup ON public.products;
CREATE TRIGGER products_require_store_setup
 BEFORE INSERT OR UPDATE ON public.products
 FOR EACH ROW EXECUTE FUNCTION public.barakaz_require_seller_store_setup();
