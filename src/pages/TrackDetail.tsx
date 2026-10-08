import { useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router'
import ErrorBanner from '../components/ErrorBanner'
import TopicRow, { type TopicActions } from '../components/TopicRow'
import TrackStats from '../components/TrackStats'
import { Chevron, MiniProgress, PageHeader, Pill, ProgressCard } from '../components/ui'
import { weeklyMinutes, type Module, type Topic } from '../lib/data'
import { todayIST } from '../lib/date'
import { fmtMin } from '../lib/format'
import { trackSummary } from '../lib/plan'
import { useCatalog } from '../lib/useCatalog'

function EstEditor({
  module,
  topicCount,
  onSave,
}: {
  module: Module
  topicCount: number
  onSave: (est: number | null) => Promise<void>
}) {
  const [draft, setDraft] = useState(module.est_minutes?.toString() ?? '')
  const [saving, setSaving] = useState(false)
  const [invalid, setInvalid] = useState(false)
  const id = `est-${module.id}`

  async function save(e?: FormEvent) {
    e?.preventDefault()
    const trimmed = draft.trim()
    const next = trimmed === '' ? null : Number(trimmed)
    if (next !== null && (!Number.isInteger(next) || next <= 0)) {
      setInvalid(true)
      return
    }
    setInvalid(false)
    if (next === module.est_minutes || saving) return
    setSaving(true)
    try {
      await onSave(next)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={save} className="flex flex-wrap items-center gap-x-2 gap-y-1 px-3 py-2.5 text-xs">
      <label htmlFor={id} className="text-muted">
        Module estimate
      </label>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={1}
        placeholder="none"
        value={draft}
        aria-invalid={invalid}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => void save()}
        className="w-16 rounded-lg border border-line bg-raised px-2 py-1.5 text-sm tabular-nums outline-none focus:border-accent aria-invalid:border-red-400"
      />
      <span className="text-muted">min</span>
      {saving && <span className="text-muted">Saving…</span>}
      {!saving && module.est_minutes !== null && topicCount > 0 && (
        <span className="text-soft tabular-nums">{fmtMin(module.est_minutes / topicCount)} per topic</span>
      )}
      {invalid && <span className="w-full text-red-400">Enter whole minutes, or leave empty for no estimate.</span>}
    </form>
  )
}

function ModuleSection({
  module,
  topics,
  initiallyOpen,
  actions,
  onSaveEst,
}: {
  module: Module
  topics: Topic[]
  initiallyOpen: boolean
  actions: TopicActions
  onSaveEst: (est: number | null) => Promise<void>
}) {
  const [open, setOpen] = useState(initiallyOpen)
  const done = topics.filter((t) => t.done).length
  return (
    <details open={open} onToggle={(e) => setOpen(e.currentTarget.open)} className="border-b border-line">
      <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2.5 py-3 [&::-webkit-details-marker]:hidden">
        <Chevron open={open} />
        <h2 className="min-w-0 flex-1 text-[13px] leading-snug">{module.name}</h2>
        {module.co && <Pill>{module.co}</Pill>}
        <MiniProgress done={done} total={topics.length} label={`${module.name} progress`} />
      </summary>
      <div className="mb-3 overflow-hidden rounded-[14px] bg-card">
        <EstEditor module={module} topicCount={topics.length} onSave={onSaveEst} />
        <ul className="divide-y divide-line border-t border-line">
          {topics.map((t) => (
            <TopicRow key={t.id} topic={t} actions={actions} showModule={false} alwaysAllowMinutes />
          ))}
        </ul>
      </div>
    </details>
  )
}

export default function TrackDetail() {
  const { trackId } = useParams()
  const { cat, error, setError, actions, updateModuleEst } = useCatalog()
  const back = { to: '/tracks', label: 'Back to tracks' }

  if (!cat) {
    return (
      <main>
        <PageHeader title="Track" back={back} />
        <div className="px-4 md:px-8">
          <ErrorBanner error={error} onDismiss={() => setError(null)} />
          {!error && <p className="text-muted">Loading track…</p>}
        </div>
      </main>
    )
  }

  const track = cat.tracks.find((t) => t.id === trackId)
  if (!track) {
    return (
      <main>
        <PageHeader title="Track" back={back} />
        <p className="px-4 text-soft md:px-8">
          This track doesn't exist.{' '}
          <Link to="/tracks" className="text-accent underline">
            See all tracks
          </Link>
        </p>
      </main>
    )
  }

  const topics = cat.topics.filter((t) => t.trackId === track.id)
  const s = trackSummary(topics, weeklyMinutes(cat, track.id), todayIST())
  const modules = cat.modules.filter((m) => m.track_id === track.id).sort((a, b) => a.sort_order - b.sort_order)
  const byModule = new Map(modules.map((m) => [m.id, topics.filter((t) => t.moduleId === m.id)]))
  const firstOpen = modules.find((m) => byModule.get(m.id)?.some((t) => !t.done))?.id

  return (
    <main>
      <PageHeader title={track.name} back={back} />
      <div className="grid items-start gap-6 px-4 pb-8 md:px-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <aside className="flex flex-col gap-4 lg:sticky lg:top-20 lg:order-2">
          {track.course_code && <p className="text-soft">{track.course_code}</p>}
          <ProgressCard done={s.doneCount} total={s.total} label={`${track.name} progress`} />
          <TrackStats s={s} modules={modules.length} />
        </aside>
        <div className="flex min-w-0 flex-col gap-4 lg:order-1">
          <ErrorBanner error={error} onDismiss={() => setError(null)} />
          <div className="border-t border-line">
            {modules.map((m) => (
              <ModuleSection
                key={m.id}
                module={m}
                topics={byModule.get(m.id) ?? []}
                initiallyOpen={m.id === firstOpen}
                actions={actions}
                onSaveEst={(est) => updateModuleEst(m.id, est).catch((e: unknown) => actions.onError(e))}
              />
            ))}
          </div>
        </div>
      </div>
    </main>
  )
}
