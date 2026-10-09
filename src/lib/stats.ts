import { addDays, weekDates } from './date'

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
