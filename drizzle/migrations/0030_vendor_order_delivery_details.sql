CREATE FUNCTION public.get_vendor_order_delivery_details(p_vendor_id uuid, p_order_ids uuid[])
RETURNS TABLE (id uuid, created_at timestamptz, shipping_address jsonb, payment_status text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT o.id, o.created_at, o.shipping_address, o.payment_status
  FROM public.orders o
  WHERE o.id = ANY(p_order_ids)
    AND EXISTS (
      SELECT 1
      FROM public.order_items oi
      JOIN public.vendors v ON v.id = oi.vendor_id
      WHERE oi.order_id = o.id
        AND v.id = p_vendor_id
        AND v.user_id = auth.uid()
    );
$$;
REVOKE ALL ON FUNCTION public.get_vendor_order_delivery_details(uuid, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_vendor_order_delivery_details(uuid, uuid[]) TO authenticated, service_role;
COMMENT ON FUNCTION public.get_vendor_order_delivery_details(uuid, uuid[]) IS 'Owner-scoped delivery and payment read for the vendor fulfilling order items; exposes no other seller lines or order payment identifiers.';