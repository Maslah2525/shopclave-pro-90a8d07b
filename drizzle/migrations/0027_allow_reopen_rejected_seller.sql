CREATE OR REPLACE FUNCTION public.review_seller_application(p_application_id uuid, p_decision text, p_reason text)
 RETURNS public.seller_applications LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE a public.seller_applications; previous_status text;
BEGIN
 IF (SELECT auth.uid()) IS NULL OR NOT public.has_role((SELECT auth.uid()),'admin') THEN RAISE EXCEPTION 'Not authorized'; END IF;
 IF p_decision NOT IN ('under_review','more_information_required','rejected') THEN RAISE EXCEPTION 'Unsupported review decision'; END IF;
 IF p_decision IN ('more_information_required','rejected') AND nullif(btrim(p_reason),'') IS NULL THEN RAISE EXCEPTION 'Review reason is required'; END IF;
 SELECT * INTO a FROM public.seller_applications WHERE id=p_application_id FOR UPDATE;
 IF a.id IS NULL OR NOT (a.status IN ('submitted','under_review','more_information_required') OR (a.status='rejected' AND p_decision='under_review')) THEN RAISE EXCEPTION 'Application cannot be reviewed in current state'; END IF;
 previous_status:=a.status;
 UPDATE public.seller_applications SET status=p_decision,reviewed_by=(SELECT auth.uid()),reviewed_at=now(),review_reason=nullif(btrim(p_reason),''),updated_at=now() WHERE id=p_application_id RETURNING * INTO a;
 INSERT INTO public.seller_application_events(application_id,actor_id,previous_status,new_status,reason) VALUES(p_application_id,(SELECT auth.uid()),previous_status,p_decision,nullif(btrim(p_reason),''));
 RETURN a;
END $function$;
REVOKE ALL ON FUNCTION public.review_seller_application(uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_seller_application(uuid,text,text) TO authenticated;