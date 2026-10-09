import { describe, expect, it } from 'vitest'
import { assignDay, keptByBlock, previewDays, type PlanBlock, type PlanTopic } from './plan'

let seq = 0
function topic(trackId: string, over: Partial<PlanTopic> = {}): PlanTopic {
  seq++
  return { id: `${trackId}-${seq}`, trackId, moduleOrder: 1, order: seq, done: false, ...over }
}
function block(id: number, trackId: string | null, topics: number, over: Partial<PlanBlock> = {}): PlanBlock {
  return { id, trackId, label: trackId ? null : `label-${id}`, topics, sortOrder: id, ...over }
}
const topicIds = (items: ReturnType<typeof assignDay>) => items.map((i) => i.topicId)

describe('assignDay', () => {
  it('adds as many topics as the block asks for', () => {
    const ts = [topic('dsa'), topic('dsa'), topic('dsa'), topic('dsa')]
    const items = assignDay([block(1, 'dsa', 3)], ts)
    expect(topicIds(items)).toEqual([ts[0]!.id, ts[1]!.id, ts[2]!.id])
  })

  it('stops early when the track runs out of topics', () => {
    const ts = [topic('or')]
    expect(topicIds(assignDay([block(1, 'or', 3)], ts))).toEqual([ts[0]!.id])
  })

  it('returns nothing for an empty track without crashing', () => {
    expect(assignDay([block(1, 'ghost', 2)], [topic('dsa')])).toEqual([])
  })

  it('returns nothing when every topic is done', () => {
    const ts = [topic('dsa', { done: true }), topic('dsa', { done: true })]
    expect(assignDay([block(1, 'dsa', 2)], ts)).toEqual([])
  })

  it('skips topics marked done ahead of plan', () => {
    const ts = [topic('dsa', { done: true }), topic('dsa'), topic('dsa', { done: true }), topic('dsa')]
    expect(topicIds(assignDay([block(1, 'dsa', 2)], ts))).toEqual([ts[1]!.id, ts[3]!.id])
  })

  it('orders by module then topic order, not input order', () => {
    const a = topic('db', { moduleOrder: 2, order: 1 })
    const b = topic('db', { moduleOrder: 1, order: 2 })
    const c = topic('db', { moduleOrder: 1, order: 1 })
    expect(topicIds(assignDay([block(1, 'db', 3)], [a, b, c]))).toEqual([c.id, b.id, a.id])
  })

  it('does not repeat a topic when a track has two blocks in one day', () => {
    const ts = [topic('dsa'), topic('dsa'), topic('dsa'), topic('dsa')]
    const items = assignDay([block(1, 'dsa', 2), block(2, 'dsa', 2)], ts)
    expect(topicIds(items)).toEqual(ts.map((t) => t.id))
    expect(items.map((i) => i.blockId)).toEqual([1, 1, 2, 2])
  })

  it('skips excluded topics', () => {
    const ts = [topic('dsa'), topic('dsa')]
    const items = assignDay([block(1, 'dsa', 1)], ts, { exclude: new Set([ts[0]!.id]) })
    expect(topicIds(items)).toEqual([ts[1]!.id])
  })

  it('emits one checklist item per non-track block', () => {
    const items = assignDay([block(1, null, 1, { label: 'PYQs' })], [])
    expect(items).toEqual([{ blockId: 1, topicId: null, label: 'PYQs', sortOrder: 0 }])
  })

  it('processes blocks by sort order and numbers items sequentially', () => {
    const ts = [topic('a'), topic('b')]
    const items = assignDay([block(1, 'b', 1, { sortOrder: 5 }), block(2, 'a', 1, { sortOrder: 1 })], ts)
    expect(items.map((i) => [i.blockId, i.sortOrder])).toEqual([[2, 0], [1, 1]])
  })

  describe('regenerate with kept (done) items', () => {
    it('reduces the block count by kept topics', () => {
      const ts = [topic('db'), topic('db'), topic('db')]
      const items = assignDay([block(1, 'db', 3)], ts, { kept: new Map([[1, 2]]) })
      expect(topicIds(items)).toEqual([ts[0]!.id])
    })
    it('adds nothing when kept items already fill the block', () => {
      expect(assignDay([block(1, 'db', 2)], [topic('db')], { kept: new Map([[1, 3]]) })).toEqual([])
    })
    it('does not re-add a kept checklist block', () => {
      expect(assignDay([block(1, null, 1)], [], { kept: new Map([[1, 0]]) })).toEqual([])
    })
  })
})

describe('keptByBlock', () => {
  it('counts kept topics per block', () => {
    const kept = [
      { blockId: 1, topicId: 'a' },
      { blockId: 1, topicId: 'b' },
    ]
    expect(keptByBlock(kept)).toEqual(new Map([[1, 2]]))
  })
  it('marks a kept checklist block as present', () => {
    expect(keptByBlock([{ blockId: 2, topicId: null }]).has(2)).toBe(true)
  })
  it('ignores items whose block was deleted', () => {
    expect(keptByBlock([{ blockId: null, topicId: 'a' }]).size).toBe(0)
  })
})

describe('previewDays', () => {
  it('does not preview the same topics on two days of one week', () => {
    const ts = [topic('dsa'), topic('dsa'), topic('dsa'), topic('dsa')]
    const [mon, thu] = previewDays([{ blocks: [block(1, 'dsa', 2)] }, { blocks: [block(2, 'dsa', 2)] }], ts)
    expect(topicIds(mon!)).toEqual([ts[0]!.id, ts[1]!.id])
    expect(topicIds(thu!)).toEqual([ts[2]!.id, ts[3]!.id])
  })
  it('skips topics already in a saved plan and returns null for that day', () => {
    const ts = [topic('dsa'), topic('dsa')]
    const out = previewDays([{ existingTopicIds: [ts[0]!.id] }, { blocks: [block(1, 'dsa', 1)] }], ts)
    expect(out[0]).toBeNull()
    expect(topicIds(out[1]!)).toEqual([ts[1]!.id])
  })
  it('returns an empty plan for a day with no blocks', () => {
    expect(previewDays([{ blocks: [] }], [topic('dsa')])).toEqual([[]])
  })
})
