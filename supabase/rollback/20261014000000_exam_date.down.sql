-- Reverts 20261014000000_exam_date. Loses the exam dates.
alter table public.tracks drop column if exists exam_date;
