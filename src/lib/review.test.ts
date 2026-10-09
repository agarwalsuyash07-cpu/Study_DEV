import { describe, expect, it } from 'vitest'
import { weakestTrack, weeklySummary } from './review'

describe('weakestTrack', () => {
  const tracks = [
    { id: 'cn', counted: true },
    { id: 'dbms', counted: true },
    { id: 'dsa', counted: false },
  ]

  it('picks the lowest average confidence of completed topics', () => {
    const topics = [
      { trackId: 'cn', done: true, confidence: 3 },
      { trackId: 'cn', done: false, confidence: null },
      { trackId: 'dbms', done: true, confidence: 1 },
      { trackId: 'dbms', done: true, confidence: 2 },
      { trackId: 'dsa', done: false, confidence: 1 },
    ]
    expect(weakestTrack(tracks, topics)).toBe('dbms')
  })

  it('treats unrated tracks as middling and breaks ties by lowest progress', () => {
    const topics = [
      { trackId: 'cn', done: true, confidence: null },
      { trackId: 'cn', done: false, confidence: null },
      { trackId: 'dbms', done: false, confidence: null },
      { trackId: 'dbms', done: false, confidence: null },
    ]
    expect(weakestTrack(tracks, topics)).toBe('dbms')
  })

  it('ignores excluded and empty tracks', () => {
    expect(weakestTrack(tracks, [{ trackId: 'dsa', done: false, confidence: 1 }])).toBeNull()
  })
})

describe('weeklySummary', () => {
  const week = ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11']

  it('counts done topics per track, missed past items, and reviews in the week', () => {
    const s = weeklySummary({
      week,
      today: '2026-10-09',
      tracks: [
        { id: 'cn', name: 'CN', weekly: 4 },
        { id: 'dbms', name: 'DBMS', weekly: 4 },
      ],
      topics: [
        { trackId: 'cn', doneAt: '2026-10-07T06:00:00Z', lastReviewedAt: null },
        { trackId: 'cn', doneAt: '2026-10-04T06:00:00Z', lastReviewedAt: '2026-10-06T06:00:00Z' },
        { trackId: 'dbms', doneAt: '2026-10-09T06:00:00Z', lastReviewedAt: '2026-10-12T06:00:00Z' },
      ],
      plans: new Map([
        ['2026-10-07', [{ done: true, deferred: false }, { done: false, deferred: false }]],
        ['2026-10-08', [{ done: false, deferred: true }, { done: false, deferred: false }]],
        // today and later aren't "missed" yet
        ['2026-10-09', [{ done: false, deferred: false }]],
      ]),
      streak: 2,
    })
    expect(s).toEqual({
      topicsDone: 2,
      perTrack: [
        { id: 'cn', name: 'CN', done: 1, planned: 4 },
        { id: 'dbms', name: 'DBMS', done: 1, planned: 4 },
      ],
      missed: 2,
      streak: 2,
      revisionsDone: 1,
    })
  })
})
