ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS submitted_for_review_at timestamptz;

CREATE OR REPLACE FUNCTION public.submit_vendor_for_review()
RETURNS timestamptz LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v public.vendors; ts timestamptz := now();
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO v FROM public.vendors WHERE user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'No store found'; END IF;
  IF v.status = 'approved' THEN RETURN v.submitted_for_review_at; END IF;
  IF v.store_name IS NULL OR v.store_name ILIKE 'Pending Store Setup%' OR length(trim(v.store_name)) < 2 THEN RAISE EXCEPTION 'Add your store name'; END IF;
  IF coalesce(length(trim(v.store_description)),0) < 10 THEN RAISE EXCEPTION 'Add a store description'; END IF;
  IF coalesce(length(trim(v.phone)),0) < 7 THEN RAISE EXCEPTION 'Add a store phone number'; END IF;
  IF v.logo_url IS NULL OR v.logo_url = '' THEN RAISE EXCEPTION 'Upload your store logo'; END IF;
  UPDATE public.vendors SET submitted_for_review_at = ts, status = CASE WHEN status = 'rejected' THEN 'pending' ELSE status END WHERE id = v.id;
  RETURN ts;
END $$;
REVOKE EXECUTE ON FUNCTION public.submit_vendor_for_review() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_vendor_for_review() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_get_vendor_owner_email(_vendor_id uuid)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE e text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  SELECT u.email INTO e FROM public.vendors v JOIN auth.users u ON u.id = v.user_id WHERE v.id = _vendor_id;
  RETURN e;
END $$;
REVOKE EXECUTE ON FUNCTION public.admin_get_vendor_owner_email(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_vendor_owner_email(uuid) TO authenticated;