-- Validated, authenticated customer return request entry point.
-- Existing direct INSERT policies must be audited before enabling the UI.
create or replace function public.submit_customer_return(
  p_order_item_id uuid, p_quantity integer, p_reason text
) returns uuid language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_user uuid := auth.uid(); v_item record; v_id uuid;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if p_quantity is null or p_quantity < 1 then raise exception 'Invalid quantity'; end if;
  if length(btrim(coalesce(p_reason, ''))) < 10 or length(p_reason) > 2000 then
    raise exception 'Reason must contain 10 to 2000 characters';
  end if;
  select oi.id, oi.order_id, oi.vendor_id, oi.quantity, o.user_id,
         o.payment_status, o.status
  into v_item from public.order_items oi
  join public.orders o on o.id = oi.order_id
  where oi.id = p_order_item_id for update of oi;
  if not found or v_item.user_id is distinct from v_user then
    raise exception 'Order item not found';
  end if;
  if v_item.payment_status <> 'paid' or v_item.status <> 'delivered' then
    raise exception 'Only paid, delivered orders can be requested for return';
  end if;
  if p_quantity > v_item.quantity then raise exception 'Invalid quantity'; end if;
  if exists (select 1 from public.return_requests r
             where r.order_item_id = p_order_item_id
               and r.status not in ('rejected', 'cancelled')) then
    raise exception 'An active return request already exists for this item';
  end if;
  insert into public.return_requests
    (order_id, order_item_id, vendor_id, user_id, quantity, reason, status)
  values (v_item.order_id, v_item.id, v_item.vendor_id, v_user, p_quantity, btrim(p_reason), 'pending')
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.submit_customer_return(uuid, integer, text) from public;
grant execute on function public.submit_customer_return(uuid, integer, text) to authenticated;
