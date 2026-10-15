-- Forward-only hardening after 0020: Stripe Connect verification is mandatory
-- for every seller KYC approval, in addition to any Barakaz documents required
-- by the effective country/business-type rules.
CREATE OR REPLACE FUNCTION public.record_seller_kyc_review(p_application_id uuid, p_result text, p_reason text)
 RETURNS seller_applications LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE a public.seller_applications; previous_kyc text; r public.seller_country_requirements; cond jsonb; eff_docs text[];
BEGIN
 IF (SELECT auth.uid()) IS NULL OR NOT public.has_role((SELECT auth.uid()),'admin') THEN RAISE EXCEPTION 'Not authorized'; END IF;
 IF p_result NOT IN ('verified','action_required','rejected') OR nullif(btrim(p_reason),'') IS NULL THEN RAISE EXCEPTION 'Documented verification decision required'; END IF;
 SELECT * INTO a FROM public.seller_applications WHERE id=p_application_id FOR UPDATE;
 IF a.id IS NULL OR a.status NOT IN ('submitted','under_review') THEN RAISE EXCEPTION 'Application not ready for KYC review'; END IF;
 IF p_result='verified' THEN
  SELECT * INTO r FROM public.seller_country_requirements WHERE country=a.country AND business_type=a.business_type AND rules_version=a.rules_version AND stripe_connect_enabled=true AND reviewed_at IS NOT NULL;
  IF r.country IS NULL THEN RAISE EXCEPTION 'Approved country rules required'; END IF;
  cond := public.seller_conditional_requirements(a.business_info, r.conditional_requirements);
  eff_docs := ARRAY(SELECT DISTINCT x FROM unnest(r.required_documents || ARRAY(SELECT jsonb_array_elements_text(cond->'required_documents'))) x);
  IF NOT EXISTS (SELECT 1 FROM public.seller_payout_accounts p WHERE p.application_id=a.id AND p.provider='stripe' AND p.verification_status='verified' AND p.payouts_enabled=true AND nullif(btrim(p.provider_account_id),'') IS NOT NULL AND p.last_webhook_at IS NOT NULL) THEN RAISE EXCEPTION 'Verified Stripe payout account required as identity evidence'; END IF;
  IF cardinality(eff_docs) > 0 AND EXISTS (SELECT 1 FROM unnest(eff_docs) req(code) WHERE NOT EXISTS (SELECT 1 FROM public.seller_verification_documents d WHERE d.application_id=a.id AND d.requirement_code=req.code AND d.verification_status='verified')) THEN RAISE EXCEPTION 'Required documents not independently verified'; END IF;
 END IF;
 previous_kyc:=a.kyc_status;
 UPDATE public.seller_applications SET kyc_status=p_result,reviewed_by=(SELECT auth.uid()),review_reason=left(btrim(p_reason),500),reviewed_at=now(),updated_at=now() WHERE id=a.id RETURNING * INTO a;
 INSERT INTO public.seller_application_events(application_id,actor_id,previous_status,new_status,reason) VALUES(a.id,(SELECT auth.uid()),'kyc:'||coalesce(previous_kyc,'unknown'),'kyc:'||p_result,left(p_reason,500));
 RETURN a;
END $function$;
REVOKE ALL ON FUNCTION public.record_seller_kyc_review(uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_seller_kyc_review(uuid,text,text) TO authenticated;