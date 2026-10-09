import { fmtPerDay, paceLabel, type Pace } from '../lib/pace'
import { StatGrid, type StatItem } from './ui'

/** Icon stat grid for the track detail header. */
export default function TrackStats({ done, total, modules, weekly, pace }: { done: number; total: number; modules: number; weekly: number; pace: Pace }) {
  const label = paceLabel(pace, weekly)
  const live = pace.daysLeft !== null && pace.daysLeft > 0
  const items: StatItem[] = [
    { icon: 'book', value: modules, label: 'Modules' },
    { icon: 'list', value: total, label: 'Topics' },
    { icon: 'check', value: done, label: 'Done' },
    { icon: 'flag', value: total - done, label: 'Left' },
    { icon: 'list', value: weekly ? `${weekly} / week` : 'None', label: 'planned' },
    { icon: 'check', value: fmtPerDay(pace.recentPerDay), label: 'per day, last 7 days' },
  ]
  if (live) {
    items.push(
      { icon: 'flag', value: pace.daysLeft, label: pace.daysLeft === 1 ? 'day to exam' : 'days to exam' },
      { icon: 'flag', value: fmtPerDay(pace.neededPerDay!), label: 'needed per day' },
    )
  }
  items.push({ icon: 'flag', value: label.text, label: 'status', tone: label.tone === 'warn' ? 'warn' : undefined })
  return <StatGrid cols="grid-cols-1" items={items} />
}
