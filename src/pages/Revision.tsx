import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import ConfidencePicker from '../components/ConfidencePicker'
import ErrorBanner from '../components/ErrorBanner'
import TopicRow, { type TopicActions } from '../components/TopicRow'
import { trackColor } from '../components/trackColor'
import { PageHeader } from '../components/ui'
import type { Topic, Track } from '../lib/data'
import { todayIST } from '../lib/date'
import { INTERVALS, isDue, type ReviewState } from '../lib/revision'
import { useCatalog } from '../lib/useCatalog'

type Entry = { topic: Topic; review: ReviewState & { dueDate: string } }

const fmtDay = (date: string) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString('en-IN', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' })
const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000)

function SectionHeading({ id, children, count, dot }: { id: string; children: ReactNode; count: number; dot: string }) {
  return (
    <div className="flex items-center gap-2 px-1 pb-2">
      <span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${dot}`} />
      <h2 id={id} className="min-w-0 flex-1 truncate font-medium">
        {children}
      </h2>
      <span className="text-[11px] text-muted tabular-nums">{count}</span>
    </div>
  )
}

function DueRow({ entry, track, today, actions }: { entry: Entry; track: Track | undefined; today: string; actions: TopicActions }) {
  const [busy, setBusy] = useState(false)
  const { topic, review } = entry
  const late = daysBetween(review.dueDate, today)

  async function run(fn: () => Promise<void>) {
    setBusy(true)
    try {
      await fn()
    } catch (e) {
      actions.onError(e)
    } finally {
      setBusy(false)
    }
  }

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5">
      <div className="min-w-0 flex-[1_1_14rem]">
        <p className="leading-snug text-soft">{topic.title}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-muted">
          {track && (
            <span className="flex items-center gap-1.5">
              <span aria-hidden="true" className="size-1.5 rounded-full" style={{ background: trackColor(track.sort_order) }} />
              {track.name}
            </span>
          )}
          <span>
            Review {review.step + 1} of {INTERVALS.length}
          </span>
          {late > 0 && <span className="text-warn">{late === 1 ? '1 day late' : `${late} days late`}</span>}
        </p>
      </div>
      <ConfidencePicker
        label={`Confidence for "${topic.title}"`}
        value={topic.confidence}
        disabled={busy}
        onChange={(c) => void run(() => actions.onSetConfidence(topic, c))}
      />
      <div className="flex shrink-0 gap-1.5">
        <button
          type="button"
          disabled={busy}
          onClick={() => void run(() => actions.onReview(topic, 'again'))}
          className="min-h-10 rounded-lg border border-line px-3 text-soft hover:border-check disabled:opacity-50"
        >
          Again
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void run(() => actions.onReview(topic, 'done'))}
          className="min-h-10 rounded-lg bg-accent px-3 font-medium text-white disabled:opacity-50"
        >
          Done
        </button>
      </div>
    </li>
  )
}

export default function Revision() {
  const { cat, error, setError, actions } = useCatalog()
  const today = todayIST()

  if (!cat) {
    return (
      <main>
        <PageHeader title="Revision" />
        <div className="px-4 md:px-8">
          <ErrorBanner error={error} onDismiss={() => setError(null)} />
          {!error && <p className="text-muted">Loading revision…</p>}
        </div>
      </main>
    )
  }

  const trackById = new Map(cat.tracks.map((t) => [t.id, t]))
  const entries: Entry[] = [...cat.revisions].flatMap(([id, r]) => {
    const topic = cat.topicById.get(id)
    return topic?.done && r.dueDate ? [{ topic, review: { ...r, dueDate: r.dueDate } }] : []
  })
  const byDue = (a: Entry, b: Entry) => a.review.dueDate.localeCompare(b.review.dueDate)
  const due = entries.filter((e) => isDue(e.review, today)).sort(byDue)
  const upcoming = entries.filter((e) => !isDue(e.review, today)).sort(byDue)
  const starredGroups = cat.tracks
    .map((track) => ({ track, topics: cat.topics.filter((t) => t.trackId === track.id && t.revision) }))
    .filter((g) => g.topics.length > 0)
  const starred = starredGroups.reduce((n, g) => n + g.topics.length, 0)

  return (
    <main>
      <PageHeader title="Revision" />
      <div className="flex flex-col gap-8 px-4 pb-8 md:px-8">
        <ErrorBanner error={error} onDismiss={() => setError(null)} />

        <section aria-labelledby="due-heading">
          <SectionHeading id="due-heading" count={due.length} dot="bg-warn">
            Due today
          </SectionHeading>
          {due.length === 0 ? (
            <p className="px-1 text-soft">Nothing to review today. Completed topics come back after 1, 3, 7 and 21 days.</p>
          ) : (
            <ul className="divide-y divide-line rounded-[14px] border border-line bg-card">
              {due.map((e) => (
                <DueRow key={e.topic.id} entry={e} track={trackById.get(e.topic.trackId)} today={today} actions={actions} />
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="upcoming-heading">
          <SectionHeading id="upcoming-heading" count={upcoming.length} dot="bg-accent">
            Upcoming
          </SectionHeading>
          {upcoming.length === 0 ? (
            <p className="px-1 text-soft">No reviews scheduled yet.</p>
          ) : (
            <ul className="divide-y divide-line rounded-[14px] border border-line bg-card">
              {upcoming.map(({ topic, review }) => {
                const inDays = daysBetween(today, review.dueDate)
                const track = trackById.get(topic.trackId)
                return (
                  <li key={topic.id} className="flex items-center gap-3 px-3 py-2.5">
                    <span aria-hidden="true" className="size-2 shrink-0 rounded-full" style={{ background: track ? trackColor(track.sort_order) : undefined }} />
                    <span className="min-w-0 flex-1 truncate text-soft">{topic.title}</span>
                    <span className="shrink-0 text-xs text-muted tabular-nums">
                      {inDays === 1 ? 'Tomorrow' : `In ${inDays} days`} · {fmtDay(review.dueDate)}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <section aria-labelledby="starred-heading">
          <SectionHeading id="starred-heading" count={starred} dot="bg-warn/60">
            Starred
          </SectionHeading>
          {starredGroups.length === 0 ? (
            <p className="px-1 text-soft">
              Nothing starred yet. Tap the star on any topic in{' '}
              <Link to="/today" className="text-accent underline">
                Today
              </Link>{' '}
              or a{' '}
              <Link to="/tracks" className="text-accent underline">
                track
              </Link>{' '}
              to collect it here.
            </p>
          ) : (
            <div className="grid items-start gap-6 lg:grid-cols-2 2xl:grid-cols-3">
              {starredGroups.map(({ track, topics }) => (
                <section key={track.id} aria-label={track.name}>
                  <h3 className="flex items-center gap-2 px-1 pb-2 text-[13px] font-medium">
                    <span aria-hidden="true" className="size-2 rounded-full" style={{ background: trackColor(track.sort_order) }} />
                    {track.name}
                    <span className="ml-auto text-[11px] font-normal text-muted tabular-nums">{topics.length}</span>
                  </h3>
                  <ul className="divide-y divide-line rounded-[14px] border border-line bg-card">
                    {topics.map((t) => (
                      <TopicRow key={t.id} topic={t} actions={actions} />
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
