-- Reverts 20261015000000_user_settings. Loses saved preferences (the app falls back to defaults).
drop table if exists public.user_settings;
