CREATE OR REPLACE FUNCTION public.order_item_has_live_payment(p_item_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT EXISTS (
 SELECT 1 FROM public.order_items i JOIN public.orders o ON o.id=i.order_id
 JOIN public.webhook_events e ON e.provider='stripe'
 AND e.payload->>'type' IN ('checkout.session.completed','checkout.session.async_payment_succeeded')
 AND e.payload->'livemode'='true'::jsonb
 AND e.payload#>>'{data,object,payment_status}'='paid'
 AND e.payload#>>'{data,object,id}'=o.stripe_checkout_session_id
 AND e.payload#>>'{data,object,payment_intent}'=o.stripe_payment_intent_id
 AND COALESCE(e.payload#>>'{data,object,metadata,order_id}',e.payload#>>'{data,object,client_reference_id}')=o.id::text
 AND lower(e.payload#>>'{data,object,currency}')=lower(o.charged_currency)
 AND (e.payload#>>'{data,object,amount_total}')::numeric=round(o.charged_amount*100)
 WHERE i.id=p_item_id AND o.payment_status='paid' AND o.payment_provider='stripe'
 AND o.stripe_checkout_session_id LIKE 'cs_live_%' AND o.charged_amount>0 AND upper(o.charged_currency)='CAD'
 );
$$;
REVOKE ALL ON FUNCTION public.order_item_has_live_payment(uuid) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.vendor_withdrawal_summary(p_vendor_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE available numeric; reserved numeric; pending numeric; live_ids jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.vendors WHERE id=p_vendor_id AND user_id=auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;
 SELECT COALESCE(sum(amount) FILTER(WHERE status='available'),0),COALESCE(sum(amount) FILTER(WHERE status='pending'),0) INTO available,pending FROM public.vendor_ledger WHERE vendor_id=p_vendor_id AND upper(currency)='CAD' AND (amount<0 OR public.order_item_has_live_payment(order_item_id));
 SELECT COALESCE(sum(amount),0) INTO reserved FROM public.withdrawal_requests WHERE vendor_id=p_vendor_id AND status IN ('pending','approved') AND upper(currency)='CAD';
 SELECT COALESCE(jsonb_agg(DISTINCT order_id),'[]'::jsonb) INTO live_ids FROM public.order_items WHERE vendor_id=p_vendor_id AND public.order_item_has_live_payment(id);
 RETURN jsonb_build_object('available',greatest(available-reserved,0),'reserved',reserved,'pending',pending,'currency','CAD','live_order_ids',live_ids);
END $$;
REVOKE ALL ON FUNCTION public.vendor_withdrawal_summary(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.vendor_withdrawal_summary(uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.recompute_vendor_balance(_vendor_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE avail numeric; pend numeric; lifetime numeric;
BEGIN
 SELECT COALESCE(sum(amount) FILTER(WHERE status='available'),0),COALESCE(sum(amount) FILTER(WHERE status='pending'),0),COALESCE(sum(amount) FILTER(WHERE entry_type='sale' AND status<>'reversed'),0) INTO avail,pend,lifetime FROM public.vendor_ledger WHERE vendor_id=_vendor_id AND upper(currency)='CAD' AND (amount<0 OR public.order_item_has_live_payment(order_item_id));
 INSERT INTO public.vendor_balances(vendor_id,available_amount,pending_amount,lifetime_sales,currency,updated_at) VALUES(_vendor_id,greatest(avail,0),greatest(pend,0),greatest(lifetime,0),'CAD',now()) ON CONFLICT(vendor_id) DO UPDATE SET available_amount=EXCLUDED.available_amount,pending_amount=EXCLUDED.pending_amount,lifetime_sales=EXCLUDED.lifetime_sales,currency='CAD',updated_at=now();
END $$;
REVOKE ALL ON FUNCTION public.recompute_vendor_balance(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.recompute_vendor_balance(uuid) TO service_role;
CREATE OR REPLACE FUNCTION public.refresh_live_payment_balances() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v uuid;
BEGIN
 IF NEW.provider='stripe' AND NEW.payload->>'type' IN ('checkout.session.completed','checkout.session.async_payment_succeeded') THEN
 FOR v IN SELECT DISTINCT i.vendor_id FROM public.order_items i JOIN public.orders o ON o.id=i.order_id WHERE o.stripe_checkout_session_id=NEW.payload#>>'{data,object,id}' LOOP PERFORM public.recompute_vendor_balance(v); END LOOP;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.refresh_live_payment_balances() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER refresh_live_payment_balances AFTER INSERT OR UPDATE ON public.webhook_events FOR EACH ROW EXECUTE FUNCTION public.refresh_live_payment_balances();
CREATE OR REPLACE FUNCTION public.guard_manual_withdrawal_review() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE funds numeric; reserved numeric;
BEGIN
 IF current_user IN ('postgres','service_role','supabase_admin') THEN RETURN NEW; END IF;
 IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Admin review required'; END IF;
 IF (to_jsonb(NEW)-ARRAY['status','admin_notes','processed_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','admin_notes','processed_at']) THEN RAISE EXCEPTION 'Withdrawal payment details and amount cannot be changed'; END IF;
 IF NEW.status IS DISTINCT FROM OLD.status AND NOT ((OLD.status='pending' AND NEW.status IN ('approved','rejected')) OR (OLD.status='approved' AND NEW.status='rejected')) THEN RAISE EXCEPTION 'Payment completion requires independently reconciled settlement evidence'; END IF;
 IF NEW.status='approved' AND OLD.status IS DISTINCT FROM 'approved' THEN
 PERFORM 1 FROM public.vendors WHERE id=NEW.vendor_id FOR UPDATE;
 SELECT COALESCE(sum(amount),0) INTO funds FROM public.vendor_ledger WHERE vendor_id=NEW.vendor_id AND upper(currency)='CAD' AND status='available' AND (amount<0 OR public.order_item_has_live_payment(order_item_id));
 SELECT COALESCE(sum(amount),0) INTO reserved FROM public.withdrawal_requests WHERE vendor_id=NEW.vendor_id AND id<>NEW.id AND upper(currency)='CAD' AND status IN ('pending','approved');
 IF upper(NEW.currency)<>'CAD' OR NEW.amount>greatest(funds-reserved,0) THEN RAISE EXCEPTION 'Insufficient verified live funds'; END IF;
 END IF;
 RETURN NEW;
END $$;