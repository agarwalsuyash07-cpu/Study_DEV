import { fmtMin } from '../lib/format'
import type { Completion, TrackSummary } from '../lib/plan'
import { StatGrid } from './ui'

export function finishLabel(c: Completion): string {
  switch (c.kind) {
    case 'done':
      return 'Complete'
    case 'no-schedule':
      return 'No schedule'
    case 'no-estimates':
      return 'Needs estimates'
    case 'date': {
      const d = new Date(`${c.date}T00:00:00Z`)
      const sameYear = d.getUTCFullYear() === new Date().getUTCFullYear()
      return d.toLocaleDateString('en-IN', { timeZone: 'UTC', day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) })
    }
  }
}

export const leftLabel = (s: TrackSummary) => (s.remainingEstMin > 0 ? fmtMin(s.remainingEstMin) : s.unestimatedCount > 0 ? '—' : '0m')

/** Icon stat grid for the track detail header. */
export default function TrackStats({ s, modules }: { s: TrackSummary; modules: number }) {
  return (
    <StatGrid
      cols="grid-cols-1"
      items={[
        { icon: 'book', value: modules, label: 'Modules' },
        { icon: 'list', value: s.total, label: 'Topics' },
        { icon: 'clock', value: fmtMin(s.spentMin), label: 'Spent' },
        { icon: 'hourglass', value: leftLabel(s), label: 'Left' },
        { icon: 'flag', value: finishLabel(s.completion), label: 'Est. finish' },
        ...(s.unestimatedCount > 0
          ? [{ icon: 'list' as const, value: s.unestimatedCount, label: 'Unestimated', tone: 'warn' as const }]
          : []),
      ]}
    />
  )
}
