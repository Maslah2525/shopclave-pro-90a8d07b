ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS setup_completed_sections text[] NOT NULL DEFAULT '{}';

CREATE OR REPLACE FUNCTION public.mark_vendor_setup_section(p_section text)
RETURNS text[] LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE result text[];
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_section NOT IN ('profile','business','shipping','payouts','tax','returns','policies','branding','notifications','team','security','compliance') THEN
    RAISE EXCEPTION 'Unknown setup section'; END IF;
  UPDATE public.vendors SET setup_completed_sections =
    (SELECT array_agg(DISTINCT s) FROM unnest(setup_completed_sections || p_section) s)
  WHERE user_id = auth.uid() RETURNING setup_completed_sections INTO result;
  IF NOT FOUND THEN RAISE EXCEPTION 'No store found'; END IF;
  RETURN result;
END $$;
REVOKE EXECUTE ON FUNCTION public.mark_vendor_setup_section(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_vendor_setup_section(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.submit_vendor_for_review()
 RETURNS timestamp with time zone LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v public.vendors; ts timestamptz := now(); missing int;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO v FROM public.vendors WHERE user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'No store found'; END IF;
  IF v.status = 'approved' THEN RETURN v.submitted_for_review_at; END IF;
  IF v.store_name IS NULL OR v.store_name ILIKE 'Pending Store Setup%' OR length(trim(v.store_name)) < 2 THEN RAISE EXCEPTION 'Add your store name'; END IF;
  IF coalesce(length(trim(v.store_description)),0) < 10 THEN RAISE EXCEPTION 'Add a store description'; END IF;
  IF coalesce(length(trim(v.phone)),0) < 7 THEN RAISE EXCEPTION 'Add a store phone number'; END IF;
  IF v.logo_url IS NULL OR v.logo_url = '' THEN RAISE EXCEPTION 'Upload your store logo'; END IF;
  SELECT count(*) INTO missing FROM unnest(ARRAY['profile','business','shipping','payouts','tax','returns','policies','branding','notifications','team','security','compliance']) s
    WHERE NOT (s = ANY(v.setup_completed_sections));
  IF missing > 0 THEN RAISE EXCEPTION 'Complete all 12 setup steps before submitting (% remaining)', missing; END IF;
  UPDATE public.vendors SET submitted_for_review_at = ts, status = CASE WHEN status = 'rejected' THEN 'pending' ELSE status END WHERE id = v.id;
  RETURN ts;
END $function$;

DROP POLICY IF EXISTS "Only approved vendors can add products" ON public.products;
CREATE POLICY "Only approved vendors can add products" ON public.products AS RESTRICTIVE FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR EXISTS (SELECT 1 FROM public.vendors WHERE vendors.id = products.vendor_id AND vendors.status = 'approved'));