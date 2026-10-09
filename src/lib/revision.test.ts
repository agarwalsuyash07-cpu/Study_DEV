import { describe, expect, it } from 'vitest'
import { afterAgain, afterDone, firstReview, intervalDays, isDue } from './revision'

describe('revision scheduling', () => {
  it('uses 1, 3, 7, 21 day gaps', () => {
    expect([0, 1, 2, 3].map((s) => intervalDays(s, 2))).toEqual([1, 3, 7, 21])
    expect(intervalDays(3, null)).toBe(21)
  })

  it('halves gaps for low confidence, never below a day', () => {
    expect([0, 1, 2, 3].map((s) => intervalDays(s, 1))).toEqual([1, 2, 4, 11])
    expect(intervalDays(2, 3)).toBe(7)
  })

  it('first review is one day after the completion day', () => {
    expect(firstReview('2026-10-09', 2)).toEqual({ dueDate: '2026-10-10', step: 0 })
  })

  it('Done walks up the ladder from the review day, then finishes', () => {
    expect(afterDone('2026-10-10', 0, 2)).toEqual({ dueDate: '2026-10-13', step: 1 })
    expect(afterDone('2026-10-13', 1, 2)).toEqual({ dueDate: '2026-10-20', step: 2 })
    expect(afterDone('2026-10-20', 2, 2)).toEqual({ dueDate: '2026-11-10', step: 3 })
    expect(afterDone('2026-11-10', 3, 2)).toEqual({ dueDate: null, step: 3 })
  })

  it('Done late still schedules from the day you actually reviewed', () => {
    expect(afterDone('2026-10-15', 0, 2)).toEqual({ dueDate: '2026-10-18', step: 1 })
  })

  it('Again resets to the first gap', () => {
    expect(afterAgain('2026-10-20', 2)).toEqual({ dueDate: '2026-10-21', step: 0 })
  })

  it('is due on or after its date, never when finished', () => {
    expect(isDue({ dueDate: '2026-10-09' }, '2026-10-09')).toBe(true)
    expect(isDue({ dueDate: '2026-10-01' }, '2026-10-09')).toBe(true)
    expect(isDue({ dueDate: '2026-10-10' }, '2026-10-09')).toBe(false)
    expect(isDue({ dueDate: null }, '2026-10-09')).toBe(false)
  })
})
