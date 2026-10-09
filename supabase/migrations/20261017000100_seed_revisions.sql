-- Topics completed before spaced revision existed get their first review (day after completion). Insert-only.
insert into public.revisions (topic_id, user_id, due_date, interval_step)
select id, user_id, (done_at at time zone 'Asia/Kolkata')::date + 1, 0
  from public.topics
 where done_at is not null
on conflict (topic_id) do nothing;
