ALTER TABLE public.withdrawal_requests ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'CAD', ADD COLUMN IF NOT EXISTS request_key uuid;
CREATE UNIQUE INDEX IF NOT EXISTS withdrawal_request_key_unique ON public.withdrawal_requests(vendor_id,request_key) WHERE request_key IS NOT NULL;
REVOKE INSERT ON public.withdrawal_requests FROM authenticated, anon;
GRANT SELECT, UPDATE ON public.withdrawal_requests TO authenticated;
GRANT ALL ON public.withdrawal_requests TO service_role;
CREATE OR REPLACE FUNCTION public.vendor_withdrawal_summary(p_vendor_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE available numeric; reserved numeric; pending numeric;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.vendors WHERE id=p_vendor_id AND user_id=auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;
 SELECT COALESCE(sum(amount) FILTER(WHERE status='available'),0),COALESCE(sum(amount) FILTER(WHERE status='pending'),0) INTO available,pending FROM public.vendor_ledger WHERE vendor_id=p_vendor_id AND upper(currency)='CAD';
 SELECT COALESCE(sum(amount),0) INTO reserved FROM public.withdrawal_requests WHERE vendor_id=p_vendor_id AND status IN ('pending','approved') AND upper(currency)='CAD';
 RETURN jsonb_build_object('available',greatest(available-reserved,0),'reserved',reserved,'pending',pending,'currency','CAD');
END $$;
REVOKE ALL ON FUNCTION public.vendor_withdrawal_summary(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.vendor_withdrawal_summary(uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.request_vendor_withdrawal(p_vendor_id uuid,p_amount numeric,p_request_key uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE prefs jsonb; details jsonb; country text; method text; available numeric; existing uuid; result uuid;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to request a withdrawal'; END IF;
 PERFORM 1 FROM public.vendors WHERE id=p_vendor_id AND user_id=auth.uid() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Not authorized'; END IF;
 IF p_request_key IS NULL THEN RAISE EXCEPTION 'Request identifier is required'; END IF;
 SELECT id INTO existing FROM public.withdrawal_requests WHERE vendor_id=p_vendor_id AND request_key=p_request_key;
 IF existing IS NOT NULL THEN RETURN existing; END IF;
 IF p_amount IS NULL OR p_amount::text IN ('NaN','Infinity','-Infinity') OR p_amount<20 OR p_amount<>round(p_amount,2) THEN RAISE EXCEPTION 'Minimum withdrawal is CA$20; use at most two decimal places'; END IF;
 SELECT settings INTO prefs FROM public.vendor_settings_preferences WHERE vendor_id=p_vendor_id AND section='payouts';
 country:=upper(trim(COALESCE(prefs->>'country',''))); method:=prefs->>'method';
 IF country !~ '^[A-Z]{2}$' THEN RAISE EXCEPTION 'Save your business country and payout details first'; END IF;
 IF country<>'CA' AND method IS DISTINCT FROM 'paypal' THEN RAISE EXCEPTION 'PayPal is required outside Canada'; END IF;
 IF method='bank' AND country='CA' THEN
  IF length(trim(COALESCE(prefs->>'bank','')))=0 OR length(trim(COALESCE(prefs->>'holderName','')))=0 OR COALESCE(prefs->>'transitNumber','') !~ '^[0-9]{5}$' OR COALESCE(prefs->>'institutionNumber','') !~ '^[0-9]{3}$' OR COALESCE(prefs->>'accountNumber','') !~ '^[0-9]{5,12}$' THEN RAISE EXCEPTION 'Complete your Canadian bank details in Store Settings'; END IF;
  details:=jsonb_build_object('country',country,'bank',prefs->>'bank','holderName',prefs->>'holderName','transitNumber',prefs->>'transitNumber','institutionNumber',prefs->>'institutionNumber','accountNumber',prefs->>'accountNumber');
 ELSIF method='paypal' THEN
  IF COALESCE(prefs->>'paypalEmail','') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN RAISE EXCEPTION 'Save a valid PayPal email in Store Settings'; END IF;
  details:=jsonb_build_object('country',country,'paypalEmail',prefs->>'paypalEmail');
 ELSE RAISE EXCEPTION 'Choose a bank account or PayPal'; END IF;
 IF EXISTS(SELECT 1 FROM public.payment_refunds r JOIN public.order_items i ON i.id=r.order_item_id WHERE i.vendor_id=p_vendor_id AND r.status NOT IN ('completed','failed','cancelled')) THEN RAISE EXCEPTION 'A refund is being reconciled; try again after it is resolved'; END IF;
 available:=(public.vendor_withdrawal_summary(p_vendor_id)->>'available')::numeric;
 IF p_amount>available THEN RAISE EXCEPTION 'Amount exceeds your confirmed available balance'; END IF;
 INSERT INTO public.withdrawal_requests(vendor_id,amount,payment_method,payment_details,status,currency,request_key) VALUES(p_vendor_id,p_amount,method,details,'pending','CAD',p_request_key) RETURNING id INTO result;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.request_vendor_withdrawal(uuid,numeric,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.request_vendor_withdrawal(uuid,numeric,uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.guard_manual_withdrawal_review() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
 IF current_user IN ('postgres','service_role','supabase_admin') THEN RETURN NEW; END IF;
 IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Admin review required'; END IF;
 IF (to_jsonb(NEW)-ARRAY['status','admin_notes','processed_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','admin_notes','processed_at']) THEN RAISE EXCEPTION 'Withdrawal payment details and amount cannot be changed'; END IF;
 IF NEW.status IS DISTINCT FROM OLD.status AND NOT ((OLD.status='pending' AND NEW.status IN ('approved','rejected')) OR (OLD.status='approved' AND NEW.status='rejected')) THEN RAISE EXCEPTION 'Payment completion requires independently reconciled settlement evidence'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_manual_withdrawal_review BEFORE UPDATE ON public.withdrawal_requests FOR EACH ROW EXECUTE FUNCTION public.guard_manual_withdrawal_review();