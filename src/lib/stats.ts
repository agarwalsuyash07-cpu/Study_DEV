import { addDays, todayIST, weekDates } from './date'

/** IST day a topic was completed, or null. */
export const doneDay = (doneAt: string | null): string | null => (doneAt ? todayIST(new Date(doneAt)) : null)

/** The one definition of "completed on `date`": topics whose done_at falls on that IST day, wherever they were ticked. */
export function topicsCompletedOn<T extends { doneAt: string | null }>(topics: readonly T[], date: string): T[] {
  return topics.filter((t) => doneDay(t.doneAt) === date)
}

/** Completions per IST day: topics by done day + checklist items ticked on their own plan day. */
export function completionsByDay(
  topics: readonly { doneAt: string | null }[],
  checklist: readonly { date: string; done: boolean }[],
): Map<string, number> {
  const out = new Map<string, number>()
  const bump = (d: string) => out.set(d, (out.get(d) ?? 0) + 1)
  for (const t of topics) {
    const d = doneDay(t.doneAt)
    if (d) bump(d)
  }
  for (const c of checklist) if (c.done) bump(c.date)
  return out
}

export type StreakRule = { planPct: number; minNoPlan: number }

/** Days that count for the streak: done ≥ max(1, planPct% of that day's plan), or ≥ minNoPlan when it had no (or an empty) plan. */
export function activeDays(doneByDay: ReadonlyMap<string, number>, planSize: ReadonlyMap<string, number>, rule: StreakRule): Set<string> {
  const out = new Set<string>()
  for (const [day, done] of doneByDay) {
    const plan = planSize.get(day) ?? 0
    const need = plan > 0 ? Math.max(1, (plan * rule.planPct) / 100) : rule.minNoPlan
    if (done >= need) out.add(day)
  }
  return out
}

/** Consecutive active days ending today (or yesterday, so an unstarted today doesn't zero it) + the longest run. */
export function streaks(active: ReadonlySet<string>, today: string): { current: number; best: number } {
  let current = 0
  for (let d = active.has(today) ? today : addDays(today, -1); active.has(d); d = addDays(d, -1)) current++

  let best = 0
  for (const d of active) {
    if (active.has(addDays(d, -1))) continue // only count from the start of each run
    let run = 1
    while (active.has(addDays(d, run))) run++
    best = Math.max(best, run)
  }
  return { current, best }
}

/** `count` Mon–Sun columns, oldest first, the last one containing `today`. */
export function heatmapWeeks(today: string, count: number): string[][] {
  return Array.from({ length: count }, (_, i) => weekDates(addDays(today, -7 * (count - 1 - i))))
}

/** Topics done that day, capped at 4. */
export function heatLevel(done: number): 0 | 1 | 2 | 3 | 4 {
  return Math.min(4, Math.max(0, Math.floor(done))) as 0 | 1 | 2 | 3 | 4
}
