import { useState } from 'react'
import { Link, useParams } from 'react-router'
import ErrorBanner from '../components/ErrorBanner'
import TopicRow, { type TopicActions } from '../components/TopicRow'
import TrackStats from '../components/TrackStats'
import { Chevron, ExamDateField, MiniProgress, PageHeader, Pill, ProgressCard } from '../components/ui'
import { paceFor, setExamDate, weeklyTopics, type Module, type Topic } from '../lib/data'
import { todayIST } from '../lib/date'
import { message, useCatalog } from '../lib/useCatalog'

function ModuleSection({
  module,
  topics,
  initiallyOpen,
  actions,
}: {
  module: Module
  topics: Topic[]
  initiallyOpen: boolean
  actions: TopicActions
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
        <ul className="divide-y divide-line">
          {topics.map((t) => (
            <TopicRow key={t.id} topic={t} actions={actions} showModule={false} />
          ))}
        </ul>
      </div>
    </details>
  )
}

export default function TrackDetail() {
  const { trackId } = useParams()
  const { cat, setCat, error, setError, actions, drawer } = useCatalog()
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
  const doneCount = topics.filter((t) => t.done).length
  const modules = cat.modules.filter((m) => m.track_id === track.id).sort((a, b) => a.sort_order - b.sort_order)
  const byModule = new Map(modules.map((m) => [m.id, topics.filter((t) => t.moduleId === m.id)]))
  const firstOpen = modules.find((m) => byModule.get(m.id)?.some((t) => !t.done))?.id

  return (
    <main>
      <PageHeader title={track.name} back={back} />
      <div className="grid items-start gap-6 px-4 pb-8 md:px-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <aside className="flex flex-col gap-4 lg:sticky lg:top-20 lg:order-2">
          {track.course_code && <p className="text-soft">{track.course_code}</p>}
          <ProgressCard done={doneCount} total={topics.length} label={`${track.name} progress`} />
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-[14px] border border-line bg-card px-3 py-2">
            <label htmlFor="exam-date" className="text-soft">
              Exam date
            </label>
            <ExamDateField
              id="exam-date"
              value={track.exam_date}
              onSave={async (v) => {
                try {
                  await setExamDate(track.id, v)
                  setCat((c) => (c ? { ...c, tracks: c.tracks.map((t) => (t.id === track.id ? { ...t, exam_date: v } : t)) } : c))
                } catch (e) {
                  setError(message(e))
                }
              }}
            />
          </div>
          <TrackStats
            done={doneCount}
            total={topics.length}
            modules={modules.length}
            weekly={weeklyTopics(cat, track.id)}
            pace={paceFor(cat, track.id, todayIST())}
          />
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
              />
            ))}
          </div>
        </div>
      </div>
      {drawer}
    </main>
  )
}
