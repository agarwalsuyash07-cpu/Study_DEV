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
