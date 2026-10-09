import { describe, expect, it } from 'vitest'
import { overdueItems, planRegeneration, reorderGroup, type DayItem, type PlanBlock, type PlanTopic } from './plan'

let seq = 0
const topic = (trackId: string, over: Partial<PlanTopic> = {}): PlanTopic => {
  seq++
  return { id: `${trackId}-${seq}`, trackId, moduleOrder: 1, order: seq, done: false, ...over }
}
const block = (id: number, trackId: string | null, topics: number): PlanBlock => ({
  id,
  trackId,
  label: trackId ? null : `label-${id}`,
  topics,
  sortOrder: id,
})
const item = (over: Partial<DayItem>): DayItem => ({
  id: ++seq,
  date: '2026-10-09',
  blockId: null,
  topicId: null,
  label: null,
  sortOrder: 0,
  done: false,
  manual: false,
  deferredTo: null,
  ...over,
})

describe('planRegeneration', () => {
  it('keeps done, hand-added and deferred items and never re-plans their topics', () => {
    const ts = [topic('cn'), topic('cn'), topic('cn'), topic('cn'), topic('cn')]
    const [a, b, c, d] = ts
    const current = [
      item({ blockId: 1, topicId: a!.id, done: true }),
      item({ blockId: 1, topicId: b!.id, deferredTo: '2026-10-10' }),
      item({ topicId: c!.id, manual: true }),
      item({ blockId: 1, topicId: d!.id }),
    ]
    const { items, removed, added } = planRegeneration([block(1, 'cn', 3)], ts, current)
    const planned = items.map((i) => i.topicId)
    expect(planned).not.toContain(a!.id)
    expect(planned).not.toContain(b!.id)
    expect(planned).not.toContain(c!.id)
    // block of 3 already holds 2 kept items, so one slot is refilled with the first free topic
    expect(planned).toEqual([d!.id])
    expect(removed).toEqual([])
    expect(added).toEqual([])
  })

  it('reports exactly what a regenerate would drop and add', () => {
    const ts = [topic('cn'), topic('cn'), topic('dbms')]
    const [cn1, cn2, db1] = ts
    const current = [item({ blockId: 1, topicId: cn1!.id }), item({ blockId: 1, topicId: cn2!.id })]
    // schedule now has a dbms block instead of cn
    const { removed, added } = planRegeneration([block(2, 'dbms', 1)], ts, current)
    expect(removed.map((i) => i.topicId)).toEqual([cn1!.id, cn2!.id])
    expect(added.map((i) => i.topicId)).toEqual([db1!.id])
  })

  it('keeps a ticked checklist item without adding the checklist again', () => {
    const current = [item({ blockId: 3, label: 'label-3', done: true })]
    const { items, added } = planRegeneration([block(3, null, 1)], [], current)
    expect(items).toEqual([])
    expect(added).toEqual([])
  })
})

describe('overdueItems', () => {
  const today = '2026-10-09'
  const notDone = () => false

  it('carries an unfinished topic from an earlier day', () => {
    const thu = item({ date: '2026-10-08', topicId: 'micro-econ-m1-t4' })
    expect(overdueItems([thu], today, notDone, new Set())).toEqual([thu])
  })

  it('drops topics done since, deferred away, or already on today', () => {
    const past = [
      item({ date: '2026-10-07', topicId: 'done-later' }),
      item({ date: '2026-10-07', topicId: 'deferred', deferredTo: '2026-10-12' }),
      item({ date: '2026-10-07', topicId: 'on-today' }),
      item({ date: '2026-10-07', label: 'Weekly review' }),
    ]
    const isDone = (id: string) => id === 'done-later'
    expect(overdueItems(past, today, isDone, new Set(['on-today']))).toEqual([])
  })

  it('lists a topic missed on several days once, at its latest day, oldest first', () => {
    const mon = item({ date: '2026-10-05', topicId: 'x' })
    const wed = item({ date: '2026-10-07', topicId: 'x' })
    const tue = item({ date: '2026-10-06', topicId: 'y' })
    expect(overdueItems([wed, tue, mon], today, notDone, new Set())).toEqual([tue, wed])
  })

  it('ignores today and future items', () => {
    expect(overdueItems([item({ date: today, topicId: 'z' })], today, notDone, new Set())).toEqual([])
  })
})

describe('reorderGroup', () => {
  const g = [
    { id: 1, sortOrder: 4 },
    { id: 2, sortOrder: 5 },
    { id: 3, sortOrder: 9 },
  ]

  it('reuses the group’s own sort slots and returns only rows that moved', () => {
    expect(reorderGroup(g, 2, 0)).toEqual([
      { id: 3, sortOrder: 4 },
      { id: 1, sortOrder: 5 },
      { id: 2, sortOrder: 9 },
    ])
    expect(reorderGroup(g, 0, 1)).toEqual([
      { id: 2, sortOrder: 4 },
      { id: 1, sortOrder: 5 },
    ])
  })

  it('is a no-op for out-of-range or same-place moves', () => {
    expect(reorderGroup(g, 1, 1)).toEqual([])
    expect(reorderGroup(g, 0, -1)).toEqual([])
    expect(reorderGroup(g, 2, 3)).toEqual([])
  })
})

describe('planRegeneration with a time budget', () => {
  it('counts kept items against the budget; deferred ones free their time', () => {
    const ts = [topic('cn'), topic('cn'), topic('cn'), topic('cn')]
    const [done, deferred, a] = ts
    const current = [
      item({ blockId: 1, topicId: done!.id, done: true }),
      item({ blockId: 1, topicId: deferred!.id, deferredTo: '2026-10-10' }),
    ]
    // block wants 4 (2 slots left); budget 60 at 30 each: done uses 30, deferred is free, so only 1 more fits
    const { items } = planRegeneration([block(1, 'cn', 4)], ts, current, { minutes: 60, estimate: () => 30 })
    expect(items.map((i) => i.topicId)).toEqual([a!.id])
  })
})
