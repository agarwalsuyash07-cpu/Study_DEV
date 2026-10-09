import { doneDay } from './stats'

/** Track to practise PYQs for: lowest average confidence of its completed topics (unrated counts as 2), then lowest progress. */
export function weakestTrack(
  tracks: readonly { id: string; counted: boolean }[],
  topics: readonly { trackId: string; done: boolean; confidence: number | null }[],
): string | null {
  const scored = tracks.flatMap((t) => {
    const ts = topics.filter((x) => x.trackId === t.id)
    if (!t.counted || ts.length === 0) return []
    const rated = ts.filter((x) => x.done && x.confidence !== null)
    const confidence = rated.length ? rated.reduce((n, x) => n + x.confidence!, 0) / rated.length : 2
    const progress = ts.filter((x) => x.done).length / ts.length
    return [{ id: t.id, confidence, progress }]
  })
  scored.sort((a, b) => a.confidence - b.confidence || a.progress - b.progress)
  return scored[0]?.id ?? null
}

export type WeekSummary = {
  topicsDone: number
  perTrack: { id: string; name: string; done: number; planned: number }[]
  /** Plan items on days before today that weren't done (deferred ones moved, so they don't count). */
  missed: number
  streak: number
  revisionsDone: number
}

/** The Sunday review card's numbers for one Mon–Sun week. */
export function weeklySummary(input: {
  week: readonly string[]
  today: string
  tracks: readonly { id: string; name: string; weekly: number }[]
  topics: readonly { trackId: string; doneAt: string | null; lastReviewedAt: string | null }[]
  plans: ReadonlyMap<string, readonly { done: boolean; deferred: boolean }[]>
  streak: number
}): WeekSummary {
  const inWeek = (iso: string | null) => {
    const d = doneDay(iso)
    return d !== null && input.week.includes(d)
  }
  const done = input.topics.filter((t) => inWeek(t.doneAt))
  let missed = 0
  for (const [date, items] of input.plans) {
    if (date >= input.today || !input.week.includes(date)) continue
    missed += items.filter((i) => !i.done && !i.deferred).length
  }
  return {
    topicsDone: done.length,
    perTrack: input.tracks.map((t) => ({ id: t.id, name: t.name, done: done.filter((x) => x.trackId === t.id).length, planned: t.weekly })),
    missed,
    streak: input.streak,
    revisionsDone: input.topics.filter((t) => inWeek(t.lastReviewedAt)).length,
  }
}
