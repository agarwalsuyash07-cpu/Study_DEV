import { describe, expect, it } from 'vitest'
import {
  assignDay,
  keptByBlock,
  previewDays,
  trackSummary,
  estCompletion,
  remainingEstimate,
  topicEst,
  type PlanBlock,
  type PlanTopic,
} from './plan'

let seq = 0
function topic(trackId: string, est: number | null, over: Partial<PlanTopic> = {}): PlanTopic {
  seq++
  return { id: `${trackId}-${seq}`, trackId, moduleOrder: 1, order: seq, est, done: false, ...over }
}
function block(id: number, trackId: string | null, minutes: number, over: Partial<PlanBlock> = {}): PlanBlock {
  return { id, trackId, label: trackId ? null : `label-${id}`, minutes, sortOrder: id, ...over }
}
const topicIds = (items: ReturnType<typeof assignDay>) => items.map((i) => i.topicId)

describe('topicEst', () => {
  it('splits module minutes evenly across its topics', () => {
    expect(topicEst(120, 4)).toBe(30)
  })
  it('is null when the module is unestimated', () => {
    expect(topicEst(null, 4)).toBeNull()
  })
  it('is null for an empty module', () => {
    expect(topicEst(120, 0)).toBeNull()
  })
})

describe('assignDay', () => {
  it('adds topics until summed est reaches block minutes', () => {
    const ts = [topic('dsa', 30), topic('dsa', 30), topic('dsa', 30), topic('dsa', 30)]
    const items = assignDay([block(1, 'dsa', 75)], ts)
    expect(topicIds(items)).toEqual([ts[0]!.id, ts[1]!.id, ts[2]!.id])
  })

  it('counts null estimates as 30 min for capacity', () => {
    const ts = [topic('cn', null), topic('cn', null), topic('cn', null), topic('cn', null)]
    expect(assignDay([block(1, 'cn', 60)], ts)).toHaveLength(2)
  })

  it('always assigns at least one topic even if it exceeds the block', () => {
    const ts = [topic('or', 200), topic('or', 10)]
    expect(topicIds(assignDay([block(1, 'or', 60)], ts))).toEqual([ts[0]!.id])
  })

  it('returns nothing for an empty track without crashing', () => {
    expect(assignDay([block(1, 'ghost', 60)], [topic('dsa', 30)])).toEqual([])
  })

  it('returns nothing when every topic is done', () => {
    const ts = [topic('dsa', 30, { done: true }), topic('dsa', 30, { done: true })]
    expect(assignDay([block(1, 'dsa', 60)], ts)).toEqual([])
  })

  it('skips topics marked done ahead of plan', () => {
    const ts = [topic('dsa', 30, { done: true }), topic('dsa', 30), topic('dsa', 30, { done: true }), topic('dsa', 30)]
    expect(topicIds(assignDay([block(1, 'dsa', 60)], ts))).toEqual([ts[1]!.id, ts[3]!.id])
  })

  it('orders by module then topic order, not input order', () => {
    const a = topic('db', 30, { moduleOrder: 2, order: 1 })
    const b = topic('db', 30, { moduleOrder: 1, order: 2 })
    const c = topic('db', 30, { moduleOrder: 1, order: 1 })
    expect(topicIds(assignDay([block(1, 'db', 90)], [a, b, c]))).toEqual([c.id, b.id, a.id])
  })

  it('does not repeat a topic when a track has two blocks in one day', () => {
    const ts = [topic('dsa', 30), topic('dsa', 30), topic('dsa', 30), topic('dsa', 30)]
    const items = assignDay([block(1, 'dsa', 60), block(2, 'dsa', 60)], ts)
    expect(topicIds(items)).toEqual(ts.map((t) => t.id))
    expect(items.map((i) => i.blockId)).toEqual([1, 1, 2, 2])
  })

  it('skips excluded topics', () => {
    const ts = [topic('dsa', 30), topic('dsa', 30)]
    const items = assignDay([block(1, 'dsa', 30)], ts, { exclude: new Set([ts[0]!.id]) })
    expect(topicIds(items)).toEqual([ts[1]!.id])
  })

  it('emits one checklist item per non-track block', () => {
    const items = assignDay([block(1, null, 180, { label: 'PYQs' })], [])
    expect(items).toEqual([{ blockId: 1, topicId: null, label: 'PYQs', sortOrder: 0 }])
  })

  it('processes blocks by sort order and numbers items sequentially', () => {
    const ts = [topic('a', 30), topic('b', 30)]
    const items = assignDay([block(1, 'b', 30, { sortOrder: 5 }), block(2, 'a', 30, { sortOrder: 1 })], ts)
    expect(items.map((i) => [i.blockId, i.sortOrder])).toEqual([[2, 0], [1, 1]])
  })

  describe('regenerate with kept (done) items', () => {
    it('reduces the block budget by kept minutes', () => {
      const ts = [topic('db', 30), topic('db', 30), topic('db', 30)]
      const items = assignDay([block(1, 'db', 90)], ts, { kept: new Map([[1, 60]]) })
      expect(topicIds(items)).toEqual([ts[0]!.id])
    })
    it('adds nothing when kept items already fill the block', () => {
      const ts = [topic('db', 30)]
      expect(assignDay([block(1, 'db', 90)], ts, { kept: new Map([[1, 120]]) })).toEqual([])
    })
    it('does not re-add a kept checklist block', () => {
      expect(assignDay([block(1, null, 30)], [], { kept: new Map([[1, 30]]) })).toEqual([])
    })
  })
})

describe('remainingEstimate', () => {
  it('sums undone estimated minutes and counts unestimated topics', () => {
    const ts = [topic('x', 30), topic('x', null), topic('x', 20, { done: true }), topic('x', 15)]
    expect(remainingEstimate(ts)).toEqual({ undoneCount: 3, remainingEstMin: 45, unestimatedCount: 1 })
  })
  it('is all zeros for an empty track', () => {
    expect(remainingEstimate([])).toEqual({ undoneCount: 0, remainingEstMin: 0, unestimatedCount: 0 })
  })
})

describe('estCompletion', () => {
  const today = '2026-10-08'
  it('is done when nothing is left, even without a schedule', () => {
    expect(estCompletion({ undoneCount: 0, remainingEstMin: 0, unestimatedCount: 0, weeklyMin: 0 }, today)).toEqual({ kind: 'done' })
  })
  it('reports no schedule when the track has 0 weekly minutes', () => {
    expect(estCompletion({ undoneCount: 3, remainingEstMin: 90, unestimatedCount: 0, weeklyMin: 0 }, today)).toEqual({ kind: 'no-schedule' })
  })
  it('reports no estimates when every remaining topic is unestimated', () => {
    expect(estCompletion({ undoneCount: 3, remainingEstMin: 0, unestimatedCount: 3, weeklyMin: 75 }, today)).toEqual({
      kind: 'no-estimates',
      unestimatedCount: 3,
    })
  })
  it('projects whole weeks', () => {
    expect(estCompletion({ undoneCount: 5, remainingEstMin: 300, unestimatedCount: 0, weeklyMin: 150 }, today)).toEqual({
      kind: 'date',
      date: '2026-10-22',
      unestimatedCount: 0,
    })
  })
  it('does not add a day for floating-point noise from split module estimates', () => {
    // 5 modules split across odd topic counts sum to slightly over 1920 (real prob-stats data)
    const ts = [[360, 9], [390, 8], [450, 9], [420, 9], [300, 8]].flatMap(([min, n]) =>
      Array.from({ length: n! }, () => topic('p', topicEst(min!, n!))),
    )
    const r = remainingEstimate(ts)
    expect(estCompletion({ ...r, weeklyMin: 120 }, '2026-10-08')).toMatchObject({ kind: 'date', date: '2027-01-28' })
  })
  it('rounds partial days up and passes the unestimated count through', () => {
    // 100/150 weeks = 4.67 days → 5
    expect(estCompletion({ undoneCount: 4, remainingEstMin: 100, unestimatedCount: 2, weeklyMin: 150 }, today)).toEqual({
      kind: 'date',
      date: '2026-10-13',
      unestimatedCount: 2,
    })
  })
})

describe('keptByBlock', () => {
  const est = new Map<string, number | null>([['a', 40], ['b', null]])
  const estOf = (id: string) => est.get(id) ?? null
  it('sums kept topic minutes per block, counting unestimated as 30', () => {
    const kept = [
      { blockId: 1, topicId: 'a', label: null },
      { blockId: 1, topicId: 'b', label: null },
    ]
    expect(keptByBlock(kept, estOf)).toEqual(new Map([[1, 70]]))
  })
  it('marks a kept checklist block as present', () => {
    expect(keptByBlock([{ blockId: 2, topicId: null, label: 'Review' }], estOf).has(2)).toBe(true)
  })
  it('ignores items whose block was deleted', () => {
    expect(keptByBlock([{ blockId: null, topicId: 'a', label: null }], estOf).size).toBe(0)
  })
})

describe('trackSummary', () => {
  it('rolls up counts, spent minutes and completion for one track', () => {
    const ts = [
      { ...topic('t', 60, { done: true }), spentMin: 50 },
      { ...topic('t', 60), spentMin: 10 },
      { ...topic('t', null), spentMin: 0 },
    ]
    expect(trackSummary(ts, 60, '2026-10-08')).toEqual({
      total: 3,
      doneCount: 1,
      spentMin: 60,
      undoneCount: 2,
      remainingEstMin: 60,
      unestimatedCount: 1,
      completion: { kind: 'date', date: '2026-10-15', unestimatedCount: 1 },
    })
  })
  it('handles an empty track', () => {
    expect(trackSummary([], 0, '2026-10-08')).toMatchObject({ total: 0, doneCount: 0, completion: { kind: 'done' } })
  })
})

describe('previewDays', () => {
  it('does not preview the same topics on two days of one week', () => {
    const ts = [topic('dsa', 30), topic('dsa', 30), topic('dsa', 30), topic('dsa', 30)]
    const [mon, thu] = previewDays([{ blocks: [block(1, 'dsa', 60)] }, { blocks: [block(2, 'dsa', 60)] }], ts)
    expect(topicIds(mon!)).toEqual([ts[0]!.id, ts[1]!.id])
    expect(topicIds(thu!)).toEqual([ts[2]!.id, ts[3]!.id])
  })
  it('skips topics already in a saved plan and returns null for that day', () => {
    const ts = [topic('dsa', 30), topic('dsa', 30)]
    const out = previewDays([{ existingTopicIds: [ts[0]!.id] }, { blocks: [block(1, 'dsa', 30)] }], ts)
    expect(out[0]).toBeNull()
    expect(topicIds(out[1]!)).toEqual([ts[1]!.id])
  })
  it('returns an empty plan for a day with no blocks', () => {
    expect(previewDays([{ blocks: [] }], [topic('dsa', 30)])).toEqual([[]])
  })
})
