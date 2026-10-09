# Decisions

**2026-10-08: Supabase remote project, no local stack.** Docker isn't installed, so migrations are applied to the remote project via the Supabase MCP; the down path was tested by applying up, down, then up again before any real data existed. Rejected: local `supabase start` (needs Docker).

**2026-10-08: Planning logic in pure TypeScript, persistence atomic in Postgres.** `assignDay` and friends are pure and unit-tested; `save_day_plan` RPC makes "create plan once" and "regenerate" transactional so a failure can't freeze an empty plan or duplicate one across tabs. Rejected: all logic in plpgsql (hard to test), plain client inserts (non-atomic).

**2026-10-08: Done-state sync via DB trigger.** Marking a topic done anywhere mirrors onto today's (IST) plan item in one place, so every caller is covered. Past days are left as history. Rejected: syncing in each page.

**2026-10-08: Seed import never overwrites app-edited estimates with null.** A non-null seed `estMinutes` wins; a null leaves the DB value. Progress, sessions, plans and the schedule are never touched (the default schedule is inserted only when empty).

**2026-10-08: `topic_spent` view instead of summing sessions in the browser.** Supabase caps API reads at 1000 rows; summing client-side would silently undercount after ~1000 sessions.

**2026-10-08: Strip float noise in `remainingEstimate`.** Per-topic estimates are fractions (module ÷ topic count); their sum drifted to 1920.0000000000007 and `ceil` added a phantom day to finish dates. Rounded to 1e-6 at the single summing point.

**2026-10-08: No TanStack Query, no Sentry.** About 300 rows and one user; pages load their own data and patch local state after writes. Add a query cache or error tracking if a second user or much larger data appears.

**2026-10-08: takeUforward visual language, laptop-first layout.** Tokens (colors, DM Sans, radii) sampled from takeuforward.org; sidebar navigation and multi-column pages, with a bottom bar only below 768px.

**2026-10-08: Dashboard is the home route; Today moved to `/today`.** An overview fits the landing page better than the task list. The dashboard only reads today's plan (`loadItems`), never `ensureDayPlan`, so looking at it doesn't freeze the day's plan. Streak counts a day as active if it has logged minutes or a completed topic; an unstarted today doesn't break it. Layout takes cues from Planly's dashboard (KPI row, heatmap, per-track progress), built with this app's own tokens and components. Rejected: a separate `/dashboard` route (two "home" pages).

**2026-10-08: Email + password login instead of magic link.** Supabase's built-in mailer allows only a few emails per hour, so magic-link sign-in on the deployed app hit HTTP 429 and locked the user out. The password is set with `npm run set-password` (admin API, service-role key, local only), which updates the existing user in place so its `user_id` (referenced by every row) is unchanged. No sign-up UI; public sign-ups should be disabled in Supabase. Rejected: custom SMTP (more setup for one user), recreating the user (would orphan all data).

**2026-10-08: Import prunes topics/modules dropped from the seed.** The seed is the source of truth for the syllabus, so editing it (e.g. DSA cut to one "do it on takeUforward" task) must show up on the site. Topics no longer in the seed are deleted **only if they have no progress** (not done, not starred, no logged minutes); otherwise they're kept and listed as a warning. Modules left empty are deleted too. Deleting a topic cascades to its plan items. Supersedes the earlier "orphans left untouched" behaviour. Rejected: soft-delete column (schema change for a one-user app).

**2026-10-08: DSA tasks link to takeUforward.** Work for the DSA track happens on takeuforward.org, so its task titles open `https://takeuforward.org/dashboard` in a new tab (`src/lib/links.ts`, keyed by track id). Ticking done still happens here. Rejected for now: a `tracks.url` column fed from the seed (migration for one link); move to it if more tracks need links.

**2026-10-08: Applied AI paused; import removes tracks dropped from `TRACK_FILES`.** Applied AI was removed from the import list (seed file kept for later). The import now also deletes a track that's no longer listed once it has no modules left, together with its schedule blocks, because the FK's `on delete set null` would otherwise leave unlabelled, trackless blocks in the week. Same progress guard as topics: a track whose topics have progress keeps them, so the track stays and a warning is printed. To restore: add `'applied-ai'` back to `TRACK_FILES`, re-run the import, and re-add its schedule block in Settings.

**2026-10-09: Time tracking removed.** No timers, logged minutes, module estimates, hours spent/left or estimated finish dates. Progress is counted in topics only. Schedule blocks now hold a topic count (1–20, default 2) and `assignDay` gives each block that many undone topics; regenerate subtracts the done topics already kept in the block. Dashboard heatmap, streak and "this week" use topics done per day (from `topics.done_at`). Migration `20261011000000_remove_time.sql` drops `sessions`, the `topic_spent` view and `modules.est_minutes`, and converts block minutes to `round(minutes / 60)` topics (min 1); its down script restores the structure but not the data. Rejected: one topic per block (less control without adding blocks); keeping the dead columns (schema lies about what the app does).
