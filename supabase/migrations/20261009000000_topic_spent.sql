-- Per-topic minutes, aggregated in Postgres so clients never hit the API row cap on sessions.
create view public.topic_spent with (security_invoker = true) as
  select topic_id, sum(minutes)::int as minutes
    from public.sessions
   group by topic_id;
