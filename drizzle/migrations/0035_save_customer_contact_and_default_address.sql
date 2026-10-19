ALTER TABLE public.addresses ADD COLUMN IF NOT EXISTS postal_code text;

CREATE OR REPLACE FUNCTION public.save_customer_details(p_full_name text, p_phone text, p_address_line text, p_city text, p_state text, p_country text, p_postal_code text)
RETURNS public.addresses
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_address public.addresses;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Sign in to save your details'; END IF;
  IF nullif(trim(p_full_name), '') IS NULL OR nullif(trim(p_phone), '') IS NULL OR nullif(trim(p_address_line), '') IS NULL OR nullif(trim(p_city), '') IS NULL OR nullif(trim(p_country), '') IS NULL THEN
    RAISE EXCEPTION 'Name, telephone, address, city and country are required';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));
  INSERT INTO public.profiles(user_id, full_name, phone)
  VALUES (v_user_id, trim(p_full_name), trim(p_phone))
  ON CONFLICT (user_id) DO UPDATE SET full_name = EXCLUDED.full_name, phone = EXCLUDED.phone, updated_at = now();
  SELECT * INTO v_address FROM public.addresses WHERE user_id = v_user_id AND is_default = true ORDER BY created_at DESC, id LIMIT 1;
  IF v_address.id IS NULL THEN
    INSERT INTO public.addresses(user_id, full_name, phone, address_line, city, state, country, postal_code, is_default)
    VALUES (v_user_id, trim(p_full_name), trim(p_phone), trim(p_address_line), trim(p_city), trim(p_state), trim(p_country), trim(p_postal_code), true)
    RETURNING * INTO v_address;
  ELSE
    UPDATE public.addresses SET full_name = trim(p_full_name), phone = trim(p_phone), address_line = trim(p_address_line), city = trim(p_city), state = trim(p_state), country = trim(p_country), postal_code = trim(p_postal_code)
    WHERE id = v_address.id AND user_id = v_user_id RETURNING * INTO v_address;
  END IF;
  RETURN v_address;
END;
$$;
REVOKE ALL ON FUNCTION public.save_customer_details(text, text, text, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_customer_details(text, text, text, text, text, text, text) TO authenticated;
