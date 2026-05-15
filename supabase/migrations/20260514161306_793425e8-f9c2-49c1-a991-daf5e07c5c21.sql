
-- fix search_path for set_updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end;
$$;

-- restrict EXECUTE on SECURITY DEFINER helpers to authenticated only
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.is_session_owner(uuid) from public, anon;
grant execute on function public.is_session_owner(uuid) to authenticated;
