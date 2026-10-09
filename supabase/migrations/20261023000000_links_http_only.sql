-- Resource links must be http(s) in the database too, not only in the client (blocks javascript:/data: via direct API writes).
create function public.all_http_links(links text[]) returns boolean
language sql immutable set search_path = '' as $$
  select coalesce(bool_and(l ~* '^https?://[^[:space:]]+$'), true) from unnest(links) as l
$$;

alter table public.topics add constraint topics_links_http check (public.all_http_links(links));

-- the constraint runs as the writing user, and harden_access removed default EXECUTE on new functions
grant execute on function public.all_http_links(text[]) to authenticated;
