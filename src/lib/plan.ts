import { addDays } from './date'

/** Capacity stand-in for unestimated topics; never used in hour math. */
export const UNESTIMATED_CAPACITY_MIN = 30

export type PlanTopic = {
  id: string
  trackId: string
  moduleOrder: number
  order: number
  est: number | null
  done: boolean
}

export type PlanBlock = {
  id: number
  trackId: string | null
  label: string | null
  minutes: number
  sortOrder: number
}

export type PlanItem = {
  blockId: number
  topicId: string | null
  label: string | null
  sortOrder: number
}

export function topicEst(moduleEstMinutes: number | null, topicCount: number): number | null {
  if (moduleEstMinutes === null || topicCount === 0) return null
  return moduleEstMinutes / topicCount
}

export function assignDay(
  blocks: readonly PlanBlock[],
  topics: readonly PlanTopic[],
  opts: { exclude?: ReadonlySet<string>; kept?: ReadonlyMap<number, number> } = {},
): PlanItem[] {
  const kept = opts.kept ?? new Map<number, number>()
  const taken = new Set(opts.exclude)
  const queues = new Map<string, PlanTopic[]>()
  for (const t of topics) {
    if (t.done) continue
    const q = queues.get(t.trackId)
    if (q) q.push(t)
    else queues.set(t.trackId, [t])
  }
  for (const q of queues.values()) q.sort((a, b) => a.moduleOrder - b.moduleOrder || a.order - b.order)

  const items: PlanItem[] = []
  const push = (blockId: number, topicId: string | null, label: string | null) =>
    items.push({ blockId, topicId, label, sortOrder: items.length })

  for (const block of [...blocks].sort((a, b) => a.sortOrder - b.sortOrder)) {
    if (block.trackId === null) {
      if (!kept.has(block.id)) push(block.id, null, block.label)
      continue
    }
    const budget = block.minutes - (kept.get(block.id) ?? 0)
    let filled = 0
    // at-least-one only applies to a block with nothing kept from before
    let hasAny = kept.has(block.id)
    for (const t of queues.get(block.trackId) ?? []) {
      if (taken.has(t.id)) continue
      if (hasAny && filled >= budget) break
      push(block.id, t.id, null)
      taken.add(t.id)
      filled += t.est ?? UNESTIMATED_CAPACITY_MIN
      hasAny = true
    }
  }
  return items
}

export type Remaining = { undoneCount: number; remainingEstMin: number; unestimatedCount: number }

export function remainingEstimate(topics: readonly Pick<PlanTopic, 'est' | 'done'>[]): Remaining {
  const r: Remaining = { undoneCount: 0, remainingEstMin: 0, unestimatedCount: 0 }
  for (const t of topics) {
    if (t.done) continue
    r.undoneCount++
    if (t.est === null) r.unestimatedCount++
    else r.remainingEstMin += t.est
  }
  // per-topic estimates are fractions; strip float noise so ceil() can't add a phantom day
  r.remainingEstMin = Math.round(r.remainingEstMin * 1e6) / 1e6
  return r
}

export type Completion =
  | { kind: 'done' }
  | { kind: 'no-schedule' }
  | { kind: 'no-estimates'; unestimatedCount: number }
  | { kind: 'date'; date: string; unestimatedCount: number }

export function estCompletion(r: Remaining & { weeklyMin: number }, today: string): Completion {
  if (r.undoneCount === 0) return { kind: 'done' }
  if (r.weeklyMin <= 0) return { kind: 'no-schedule' }
  if (r.remainingEstMin === 0) return { kind: 'no-estimates', unestimatedCount: r.unestimatedCount }
  const days = Math.ceil((r.remainingEstMin / r.weeklyMin) * 7)
  return { kind: 'date', date: addDays(today, days), unestimatedCount: r.unestimatedCount }
}

/** Regenerate input: per block, minutes already covered by kept (done) items. Checklist blocks just need presence. */
export function keptByBlock(
  kept: readonly { blockId: number | null; topicId: string | null; label: string | null }[],
  estOf: (topicId: string) => number | null,
): Map<number, number> {
  const out = new Map<number, number>()
  for (const k of kept) {
    if (k.blockId === null) continue
    const min = k.topicId === null ? 0 : (estOf(k.topicId) ?? UNESTIMATED_CAPACITY_MIN)
    out.set(k.blockId, (out.get(k.blockId) ?? 0) + min)
  }
  return out
}

export type TrackSummary = Remaining & { total: number; doneCount: number; spentMin: number; completion: Completion }

export function trackSummary(
  topics: readonly (Pick<PlanTopic, 'est' | 'done'> & { spentMin: number })[],
  weeklyMin: number,
  today: string,
): TrackSummary {
  const r = remainingEstimate(topics)
  return {
    total: topics.length,
    doneCount: topics.length - r.undoneCount,
    spentMin: topics.reduce((s, t) => s + t.spentMin, 0),
    ...r,
    completion: estCompletion({ ...r, weeklyMin }, today),
  }
}

/** Simulates consecutive days without saving. Saved days return null but still reserve their topics. */
export function previewDays(
  days: readonly ({ existingTopicIds: readonly string[] } | { blocks: readonly PlanBlock[] })[],
  topics: readonly PlanTopic[],
): (PlanItem[] | null)[] {
  const exclude = new Set<string>()
  return days.map((d) => {
    if ('existingTopicIds' in d) {
      for (const id of d.existingTopicIds) exclude.add(id)
      return null
    }
    const items = assignDay(d.blocks, topics, { exclude })
    for (const i of items) if (i.topicId) exclude.add(i.topicId)
    return items
  })
}
