revoke all on function public.submit_customer_return(uuid, integer, text) from public, anon;
grant execute on function public.submit_customer_return(uuid, integer, text) to authenticated;