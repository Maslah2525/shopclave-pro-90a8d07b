-- Staging-first seller registration hardening.
-- Does not enable new countries or remove the existing Canada-only launch trigger.
-- Run only after verifying migration order and deployed RPC definition.
CREATE OR REPLACE FUNCTION public.validate_seller_business_country_fields(
  p_country text, p_business_type text, p_info jsonb, p_store_info jsonb, p_required_fields text[] DEFAULT '{}'::text[]
) RETURNS void LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE k text; required text[];
BEGIN
 IF p_country IS NULL OR p_country !~ '^[A-Z]{2}$'
    OR p_business_type IS NULL OR p_business_type NOT IN ('individual','sole_proprietor','company')
    OR jsonb_typeof(p_info) IS DISTINCT FROM 'object'
 THEN RAISE EXCEPTION 'Invalid seller country or business type'; END IF;
 required := ARRAY['legal_name','address_line1','city'];
 IF p_country IN ('CA','US') THEN required := required || ARRAY['region','postal_code']; END IF;
 IF p_country IN ('GB','DE','FR') THEN required := required || ARRAY['postal_code']; END IF;
 IF p_country = 'CN' THEN required := required || ARRAY['region']; END IF;
 IF p_business_type = 'company' OR (p_business_type = 'sole_proprietor' AND p_info->>'is_business_registered' = 'true')
 THEN required := required || ARRAY['registration_number']; END IF;
 required := required || coalesce(p_required_fields, '{}'::text[]);
 FOREACH k IN ARRAY required LOOP
   IF k !~ '^[a-z][a-z0-9_]{0,63}$' THEN RAISE EXCEPTION 'Invalid seller requirement field'; END IF;
   IF nullif(btrim(coalesce(p_info->>k,p_store_info->>k,'')),'') IS NULL THEN
     RAISE EXCEPTION 'Missing required seller business field: %', k;
   END IF;
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.validate_seller_business_country_fields(text,text,jsonb,jsonb,text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.validate_seller_business_country_fields(text,text,jsonb,jsonb,text[]) TO service_role;

-- Apply as an additional database guard for all status transitions into review.
-- Trigger is intentionally independent of client UI and of RPC implementation.
CREATE OR REPLACE FUNCTION public.guard_seller_business_country_fields()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE r public.seller_country_requirements;
BEGIN
 IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('submitted','under_review','approved') THEN
   SELECT * INTO r FROM public.seller_country_requirements
    WHERE country = NEW.country AND business_type = NEW.business_type
      AND stripe_connect_enabled = true AND reviewed_at IS NOT NULL
    ORDER BY reviewed_at DESC LIMIT 1;
   IF r.country IS NULL THEN RAISE EXCEPTION 'Country and business type have not been approved for seller submission'; END IF;
   PERFORM public.validate_seller_business_country_fields(NEW.country, NEW.business_type, NEW.business_info, NEW.store_info, r.required_fields);
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.guard_seller_business_country_fields() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS seller_business_country_fields_guard ON public.seller_applications;
CREATE TRIGGER seller_business_country_fields_guard
BEFORE UPDATE OF status ON public.seller_applications
FOR EACH ROW EXECUTE FUNCTION public.guard_seller_business_country_fields();
