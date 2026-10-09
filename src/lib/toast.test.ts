import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { dismissToast, getToasts, holdToast, releaseToast, showToast, TOAST_MS } from './toast'

beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  for (const t of getToasts()) dismissToast(t.id)
  vi.useRealTimers()
})

describe('toast store', () => {
  it('disappears after 5 seconds', () => {
    showToast({ message: 'Done', actions: [] })
    expect(getToasts()).toHaveLength(1)
    vi.advanceTimersByTime(TOAST_MS - 1)
    expect(getToasts()).toHaveLength(1)
    vi.advanceTimersByTime(1)
    expect(getToasts()).toHaveLength(0)
  })

  it('keeps at most three, dropping the oldest', () => {
    for (const m of ['a', 'b', 'c', 'd']) showToast({ message: m, actions: [] })
    expect(getToasts().map((t) => t.message)).toEqual(['b', 'c', 'd'])
  })

  it('pauses while hovered or focused and restarts the full 5 seconds after', () => {
    const id = showToast({ message: 'Done', actions: [] })
    vi.advanceTimersByTime(4000)
    holdToast(id)
    vi.advanceTimersByTime(60_000)
    expect(getToasts()).toHaveLength(1)
    releaseToast(id)
    vi.advanceTimersByTime(TOAST_MS - 1)
    expect(getToasts()).toHaveLength(1)
    vi.advanceTimersByTime(1)
    expect(getToasts()).toHaveLength(0)
  })
})
