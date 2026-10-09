import { addDays } from './date'

export type Confidence = 1 | 2 | 3
export type ReviewState = { dueDate: string | null; step: number }

/** Gap in days before the review at each step; a passed review moves one step up. */
export const INTERVALS = [1, 3, 7, 21] as const

/** Gap before the review at `step`; low confidence (1) halves it, never below a day. */
export function intervalDays(step: number, confidence: Confidence | null): number {
  const base = INTERVALS[Math.min(step, INTERVALS.length - 1)]!
  return confidence === 1 ? Math.max(1, Math.round(base / 2)) : base
}

/** First review after completing a topic on `doneDay`. */
export const firstReview = (doneDay: string, confidence: Confidence | null): ReviewState => ({
  dueDate: addDays(doneDay, intervalDays(0, confidence)),
  step: 0,
})

/** "Done": next gap counted from the day you actually reviewed; after the last gap the topic is finished (dueDate null). */
export function afterDone(today: string, step: number, confidence: Confidence | null): ReviewState {
  const next = step + 1
  if (next >= INTERVALS.length) return { dueDate: null, step }
  return { dueDate: addDays(today, intervalDays(next, confidence)), step: next }
}

/** "Again": back to the first gap. */
export const afterAgain = (today: string, confidence: Confidence | null): ReviewState => ({
  dueDate: addDays(today, intervalDays(0, confidence)),
  step: 0,
})

export const isDue = (r: { dueDate: string | null }, today: string) => r.dueDate !== null && r.dueDate <= today

export const CONFIDENCE_NAMES: Record<Confidence, string> = { 1: 'low', 2: 'okay', 3: 'high' }
