-- Topic drawer: markdown notes, resource links, and a practice-problems flag for Apply/Analyze topics.
alter table public.topics
  add column notes text check (char_length(notes) <= 20000),
  add column links text[] not null default '{}' check (cardinality(links) <= 50),
  add column practice_done boolean not null default false;
