-- Rows created in the app (CSV import, new tracks) must survive `npm run import`, which prunes rows no longer in the seed.
-- Existing rows all came from the seed; anything inserted from now on defaults to 'app'.
alter table public.tracks add column origin text not null default 'seed' check (origin in ('seed', 'app'));
alter table public.modules add column origin text not null default 'seed' check (origin in ('seed', 'app'));
alter table public.topics add column origin text not null default 'seed' check (origin in ('seed', 'app'));
alter table public.tracks alter column origin set default 'app';
alter table public.modules alter column origin set default 'app';
alter table public.topics alter column origin set default 'app';

-- Checklist-style tracks (DSA: one "do it on takeUforward" item) are left out of the overall %.
alter table public.tracks add column count_in_overall boolean not null default true;
update public.tracks set count_in_overall = false where id = 'dsa';

-- Applied AI back as an empty track to fill in-app (seed/applied-ai.json stays a draft).
insert into public.tracks (id, user_id, name, type, sort_order, origin)
select 'applied-ai', t.user_id, 'Applied AI', 'roadmap', (select max(sort_order) + 1 from public.tracks), 'app'
  from public.tracks t
 order by t.sort_order
 limit 1
on conflict (id) do nothing;

-- Atomic CSV import: finds or creates each module by name, appends topics, skips titles already in that module.
create function public.import_topics(p_track_id text, p_rows jsonb) returns int
language plpgsql security invoker set search_path = '' as $$
declare
  uid uuid := auth.uid();
  r jsonb;
  mod_id text;
  added int := 0;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  if not exists (select 1 from public.tracks where id = p_track_id and user_id = uid) then
    raise exception 'track not found';
  end if;
  if jsonb_array_length(p_rows) > 2000 then
    raise exception 'too many rows (max 2000)';
  end if;

  for r in select value from jsonb_array_elements(p_rows) loop
    if coalesce(trim(r->>'module'), '') = '' or coalesce(trim(r->>'title'), '') = '' then
      raise exception 'every row needs a module and a title';
    end if;

    mod_id := null;
    select id into mod_id from public.modules
     where track_id = p_track_id and user_id = uid and lower(name) = lower(trim(r->>'module'))
     order by sort_order limit 1;
    if mod_id is null then
      mod_id := p_track_id || '-m-' || substr(gen_random_uuid()::text, 1, 8);
      insert into public.modules (id, user_id, track_id, sort_order, name, origin)
      values (mod_id, uid, p_track_id,
              (select coalesce(max(sort_order), 0) + 1 from public.modules where track_id = p_track_id),
              trim(r->>'module'), 'app');
    end if;

    if not exists (select 1 from public.topics where module_id = mod_id and lower(title) = lower(trim(r->>'title'))) then
      insert into public.topics (id, user_id, module_id, sort_order, title, bloom, est_minutes, origin)
      values (mod_id || '-t-' || substr(gen_random_uuid()::text, 1, 8), uid, mod_id,
              (select coalesce(max(sort_order), 0) + 1 from public.topics where module_id = mod_id),
              trim(r->>'title'), nullif(r->>'bloom', ''), (nullif(r->>'est_minutes', ''))::int, 'app');
      added := added + 1;
    end if;
  end loop;
  return added;
end $$;

revoke execute on function public.import_topics(text, jsonb) from public, anon;
grant execute on function public.import_topics(text, jsonb) to authenticated;
