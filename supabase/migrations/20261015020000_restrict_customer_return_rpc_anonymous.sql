-- Explicitly restrict execution to signed-in users.
-- Keep this migration in source control to match the live anonymous-role fix.
revoke execute on function public.submit_customer_return(uuid, integer, text) from PUBLIC;
revoke execute on function public.submit_customer_return(uuid, integer, text) from anon;
grant execute on function public.submit_customer_return(uuid, integer, text) to authenticated;
