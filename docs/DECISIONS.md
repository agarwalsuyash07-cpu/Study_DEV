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
