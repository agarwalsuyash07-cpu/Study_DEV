import { StatGrid } from './ui'

/** Icon stat grid for the track detail header. */
export default function TrackStats({ done, total, modules, weekly }: { done: number; total: number; modules: number; weekly: number }) {
  return (
    <StatGrid
      cols="grid-cols-1"
      items={[
        { icon: 'book', value: modules, label: 'Modules' },
        { icon: 'list', value: total, label: 'Topics' },
        { icon: 'check', value: done, label: 'Done' },
        { icon: 'flag', value: total - done, label: 'Left' },
        { icon: 'list', value: weekly || '—', label: 'Topics / week' },
      ]}
    />
  )
}
