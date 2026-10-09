export type PlanTopic = {
  id: string
  trackId: string
  moduleOrder: number
  order: number
  done: boolean
}

export type PlanBlock = {
  id: number
  trackId: string | null
  label: string | null
  topics: number
  sortOrder: number
}

export type PlanItem = {
  blockId: number
  topicId: string | null
  label: string | null
  sortOrder: number
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
    let left = block.topics - (kept.get(block.id) ?? 0)
    for (const t of queues.get(block.trackId) ?? []) {
      if (left <= 0) break
      if (taken.has(t.id)) continue
      push(block.id, t.id, null)
      taken.add(t.id)
      left--
    }
  }
  return items
}

/** Regenerate input: per block, how many kept (done) topics it already holds. Checklist blocks just need presence. */
export function keptByBlock(kept: readonly { blockId: number | null; topicId: string | null }[]): Map<number, number> {
  const out = new Map<number, number>()
  for (const k of kept) {
    if (k.blockId === null) continue
    out.set(k.blockId, (out.get(k.blockId) ?? 0) + (k.topicId === null ? 0 : 1))
  }
  return out
}

/** A saved plan item as the pure planner sees it; `done` is the caller's truth (topic done for topic items). */
export type DayItem = {
  id: number
  date: string
  blockId: number | null
  topicId: string | null
  label: string | null
  sortOrder: number
  done: boolean
  manual: boolean
  deferredTo: string | null
}

const survivesRegenerate = (i: DayItem) => i.done || i.manual || i.deferredTo !== null
const itemKey = (i: { topicId: string | null; label: string | null }) => i.topicId ?? `label:${i.label}`

/** What "Regenerate" would do: new items to save, plus the net removals/additions to show before confirming. */
export function planRegeneration(
  blocks: readonly PlanBlock[],
  topics: readonly PlanTopic[],
  current: readonly DayItem[],
): { items: PlanItem[]; removed: DayItem[]; added: PlanItem[] } {
  const keep = current.filter(survivesRegenerate)
  const drop = current.filter((i) => !survivesRegenerate(i))
  const exclude = new Set(keep.flatMap((i) => (i.topicId ? [i.topicId] : [])))
  const items = assignDay(blocks, topics, { exclude, kept: keptByBlock(keep) })
  const before = new Set(drop.map(itemKey))
  const after = new Set(items.map(itemKey))
  return { items, removed: drop.filter((i) => !after.has(itemKey(i))), added: items.filter((i) => !before.has(itemKey(i))) }
}

/** Unfinished topics from earlier days that are still undone and not on today's list: latest day per topic, oldest first. */
export function overdueItems(
  past: readonly DayItem[],
  today: string,
  isTopicDone: (topicId: string) => boolean,
  onToday: ReadonlySet<string>,
): DayItem[] {
  const latest = new Map<string, DayItem>()
  for (const i of past) {
    if (i.date >= today || i.topicId === null || i.deferredTo !== null) continue
    if (isTopicDone(i.topicId) || onToday.has(i.topicId)) continue
    const prev = latest.get(i.topicId)
    if (!prev || i.date > prev.date) latest.set(i.topicId, i)
  }
  return [...latest.values()].sort((a, b) => a.date.localeCompare(b.date) || a.sortOrder - b.sortOrder)
}

/** Moves group[from] to `to`, reusing the group's own sort slots; returns only the rows whose slot changed. */
export function reorderGroup<T extends { id: number; sortOrder: number }>(
  group: readonly T[],
  from: number,
  to: number,
): { id: number; sortOrder: number }[] {
  if (from === to || from < 0 || to < 0 || from >= group.length || to >= group.length) return []
  const slots = group.map((g) => g.sortOrder).sort((a, b) => a - b)
  const moved = [...group]
  moved.splice(to, 0, ...moved.splice(from, 1))
  return moved.flatMap((g, i) => (g.sortOrder === slots[i] ? [] : [{ id: g.id, sortOrder: slots[i]! }]))
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
