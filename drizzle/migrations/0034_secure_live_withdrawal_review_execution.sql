ALTER FUNCTION public.guard_manual_withdrawal_review() SECURITY DEFINER;
CREATE OR REPLACE FUNCTION public.guard_manual_withdrawal_review() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE funds numeric; reserved numeric;
BEGIN
 IF auth.uid() IS NULL AND current_user IN ('postgres','service_role','supabase_admin') THEN RETURN NEW; END IF;
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
REVOKE ALL ON FUNCTION public.guard_manual_withdrawal_review() FROM PUBLIC,anon,authenticated;