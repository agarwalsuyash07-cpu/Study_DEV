import { addDays, todayIST } from './date'

export type PaceTopic = { done: boolean; doneAt: string | null }

export type PaceStatus =
  | { kind: 'no-exam' }
  | { kind: 'complete' }
  | { kind: 'exam-passed' }
  | { kind: 'ahead'; by: number }
  | { kind: 'behind'; by: number }

export type Pace = {
  left: number
  /** Study days before the exam, today included; null without an exam date. */
  daysLeft: number | null
  neededPerDay: number | null
  /** Average topics done per day over the last 7 days (today and the 6 before). */
  recentPerDay: number
  /** Topics of slack (+) or shortfall (−) at the exam if the 7-day pace holds. */
  aheadBy: number | null
  status: PaceStatus
}

const WINDOW = 7
const dayCount = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000)
// float noise like 0.9999999 must not flip a whole topic
const tidy = (x: number) => Math.round(x * 1e6) / 1e6

export function trackPace(topics: readonly PaceTopic[], examDate: string | null, today: string): Pace {
  const left = topics.filter((t) => !t.done).length
  const since = addDays(today, -(WINDOW - 1))
  const recent = topics.filter((t) => {
    if (!t.done || !t.doneAt) return false
    const d = todayIST(new Date(t.doneAt))
    return d >= since && d <= today
  }).length
  const recentPerDay = recent / WINDOW

  const daysLeft = examDate ? dayCount(today, examDate) : null
  const live = daysLeft !== null && daysLeft > 0
  const neededPerDay = live ? left / daysLeft : null
  const aheadBy = live ? Math.floor(tidy(recentPerDay * daysLeft - left)) : null

  const status: PaceStatus =
    left === 0
      ? { kind: 'complete' }
      : daysLeft === null
        ? { kind: 'no-exam' }
        : !live
          ? { kind: 'exam-passed' }
          : aheadBy! >= 0
            ? { kind: 'ahead', by: aheadBy! }
            : { kind: 'behind', by: -aheadBy! }
  return { left, daysLeft, neededPerDay, recentPerDay, aheadBy, status }
}

/** Dashboard banner: behind if any track with an upcoming exam is behind. */
export function overallStatus(paces: readonly Pace[]): { kind: 'no-exams' | 'on-track' | 'behind'; behind: number; dated: number } {
  const dated = paces.filter((p) => p.daysLeft !== null && p.daysLeft > 0)
  const behind = dated.filter((p) => p.status.kind === 'behind').length
  return { kind: dated.length === 0 ? 'no-exams' : behind > 0 ? 'behind' : 'on-track', behind, dated: dated.length }
}

export const fmtPerDay = (n: number) => (n >= 10 ? Math.round(n).toString() : n.toFixed(1))

/** One-line pace text + tone for cards and tables. */
export function paceLabel(p: Pace, weekly: number): { text: string; tone: 'done' | 'warn' | 'muted' } {
  switch (p.status.kind) {
    case 'complete':
      return { text: 'Complete', tone: 'done' }
    case 'no-exam':
      return { text: weekly ? `${weekly}/week planned · no exam date` : 'No exam date', tone: 'muted' }
    case 'exam-passed':
      return { text: p.daysLeft === 0 ? 'Exam today' : 'Exam passed', tone: 'muted' }
    case 'ahead':
      return { text: `${p.status.by ? `Ahead by ${p.status.by}` : 'On track'} · need ${fmtPerDay(p.neededPerDay!)}/day`, tone: 'done' }
    case 'behind':
      return { text: `Behind by ${p.status.by} · need ${fmtPerDay(p.neededPerDay!)}/day`, tone: 'warn' }
  }
}
