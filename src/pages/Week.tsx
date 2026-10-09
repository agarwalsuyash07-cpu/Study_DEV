import { useEffect, useState } from 'react'
import ErrorBanner from '../components/ErrorBanner'
import { AddItem, ItemMenu, SubjectPicker } from '../components/PlanControls'
import ProgressBar from '../components/ProgressBar'
import { Check } from '../components/TopicRow'
import { trackColor } from '../components/trackColor'
import WeeklyReview from '../components/WeeklyReview'
import { PageHeader, Pill } from '../components/ui'
import {
  addPlanItem,
  blocksFor,
  deferItem,
  doneAtFor,
  loadGeneratedDays,
  loadPlansBetween,
  needsSubject,
  setItemDoneAt,
  setItemTrack,
  type Catalog,
  type Item,
} from '../lib/data'
import { addDays, todayIST, weekDates } from '../lib/date'
import { previewDays } from '../lib/plan'
import { weakestTrack } from '../lib/review'
import { topicsCompletedOn } from '../lib/stats'
import { showToast } from '../lib/toast'
import { message, useCatalog } from '../lib/useCatalog'

type Row = { key: string; item: Item | null; topicId: string | null; label: string | null; done: boolean; preview: boolean }
type Day = { date: string; kind: 'past' | 'today' | 'future'; rows: Row[]; hasPlan: boolean }

const topicIds = (items: Item[]) => items.flatMap((i) => (i.topic_id ? [i.topic_id] : []))

function buildDays(cat: Catalog, dates: string[], today: string, plans: Map<string, Item[]>, generated: Set<string>): Day[] {
  const upcoming = dates.filter((d) => d >= today)
  // generated days reserve their topics; ungenerated ones preview around what they already hold
  const previews = previewDays(
    upcoming.map((d) => {
      const saved = plans.get(d) ?? []
      return generated.has(d) ? { existingTopicIds: topicIds(saved) } : { blocks: blocksFor(cat, d), held: topicIds(saved) }
    }),
    cat.topics,
  )
  return dates.map((date) => {
    const kind = date < today ? 'past' : date === today ? 'today' : 'future'
    // deferred originals live on in their new day, so they don't show here
    const saved: Row[] = (plans.get(date) ?? [])
      .filter((i) => i.deferred_to === null)
      .map((i) => ({ key: `s${i.id}`, item: i, topicId: i.topic_id, label: i.label, done: i.done_at !== null, preview: false }))
    const preview: Row[] =
      date >= today && !generated.has(date)
        ? (previews[upcoming.indexOf(date)] ?? []).map((p, n) => ({ key: `p${n}`, item: null, topicId: p.topicId, label: p.label, done: false, preview: true }))
        : []
    return { date, kind, rows: [...saved, ...preview], hasPlan: plans.has(date) }
  })
}

const fmtDay = (date: string, opts: Intl.DateTimeFormatOptions) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString('en-IN', { timeZone: 'UTC', ...opts })

export default function Week() {
  const { cat, error, setError, actions, drawer } = useCatalog({ onDoneChanged: () => void reload() })
  const [today] = useState(todayIST)
  const dates = weekDates(today)
  const from = dates[0]!
  const to = dates[6]!
  const [plans, setPlans] = useState<Map<string, Item[]> | null>(null)
  const [generated, setGenerated] = useState<Set<string>>(new Set())
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [adding, setAdding] = useState<string | null>(null)

  function reload() {
    return Promise.all([loadPlansBetween(from, to), loadGeneratedDays(from, to)]).then(
      ([p, g]) => {
        setPlans(p)
        setGenerated(g)
      },
      (e: unknown) => setError(message(e)),
    )
  }

  useEffect(() => {
    let cancelled = false
    Promise.all([loadPlansBetween(from, to), loadGeneratedDays(from, to)]).then(
      ([p, g]) => {
        if (cancelled) return
        setPlans(p)
        setGenerated(g)
      },
      (e: unknown) => {
        if (!cancelled) setError(message(e))
      },
    )
    return () => {
      cancelled = true
    }
  }, [from, to, setError])

  // reports failures in the banner instead of letting them reject unhandled
  function run(fn: () => Promise<unknown>) {
    fn().catch((e: unknown) => setError(message(e)))
  }

  async function toggleRow(row: Row, date: string) {
    const topic = row.topicId ? cat?.topicById.get(row.topicId) : undefined
    // topics: completion moves to this day (past days are backfilled at noon IST); the trigger ticks the item
    if (topic) return actions.onSetDoneAt(topic, row.done ? null : doneAtFor(date, today))
    if (!row.item) return
    const itemId = row.item.id
    const prev = row.item.done_at
    const apply = async (doneAt: string | null) => {
      await setItemDoneAt(itemId, doneAt)
      await reload()
    }
    await apply(row.done ? null : doneAtFor(date, today))
    showToast({ message: `${row.done ? 'Not done' : 'Done'}: ${row.label ?? ''}`, actions: [{ label: 'Undo', run: () => apply(prev) }] })
  }

  if (!cat || !plans) {
    return (
      <main>
        <PageHeader title="This week" />
        <div className="px-4 md:px-8">
          <ErrorBanner error={error} onDismiss={() => setError(null)} />
          {!error && <p className="text-muted">Loading week…</p>}
        </div>
      </main>
    )
  }

  const days = buildDays(cat, dates, today, plans, generated)
  const trackById = new Map(cat.tracks.map((t) => [t.id, t]))
  const subjects = cat.tracks.filter((t) => t.count_in_overall)
  const weakest = weakestTrack(
    cat.tracks.map((t) => ({ id: t.id, counted: t.count_in_overall })),
    cat.topics,
  )
  // empty past days fold into one line of chips instead of taking a full card each
  const folded = days.filter((d) => d.kind === 'past' && d.rows.length === 0 && !expanded.has(d.date))
  const shown = days.filter((d) => !folded.includes(d))

  return (
    <main>
      <PageHeader title="This week" />
      <header className="px-4 pb-4 md:px-8">
        <h2 className="pt-1 text-xl font-medium">Monday to Sunday</h2>
        <p className="text-soft">
          {fmtDay(from, { day: 'numeric', month: 'short' })} to {fmtDay(to, { day: 'numeric', month: 'short' })}
        </p>
      </header>

      <div className="flex flex-col gap-4 px-4 pb-8 md:px-8">
        <ErrorBanner error={error} onDismiss={() => setError(null)} />

        {folded.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
            <span>Nothing planned:</span>
            {folded.map((d) => (
              <button
                key={d.date}
                type="button"
                onClick={() => setExpanded((s) => new Set(s).add(d.date))}
                aria-label={`Show ${fmtDay(d.date, { weekday: 'long', day: 'numeric', month: 'long' })} to add or backfill items`}
                className="min-h-10 rounded-full border border-line px-3 hover:border-check hover:text-soft"
              >
                {fmtDay(d.date, { weekday: 'short', day: 'numeric' })}
              </button>
            ))}
          </div>
        )}

        {/* equal-height cards per row keep the gaps even */}
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 min-[1700px]:grid-cols-7">
          {shown.map((d) => {
            const saved = d.rows.filter((r) => !r.preview)
            const done = saved.filter((r) => r.done).length
            const weekday = fmtDay(d.date, { weekday: 'long' })
            const onDay = new Set(d.rows.flatMap((r) => (r.topicId ? [r.topicId] : [])))
            const extra = d.kind === 'future' ? 0 : topicsCompletedOn(cat.topics, d.date).filter((t) => !onDay.has(t.id)).length
            const nextDay = addDays(d.date, 1)
            const defers =
              d.kind === 'past'
                ? [
                    { label: 'Do it today', date: today },
                    { label: 'Defer to tomorrow', date: addDays(today, 1) },
                  ]
                : [{ label: 'Defer to next day', date: nextDay }]
            return (
              <li
                key={d.date}
                className={`flex flex-col overflow-visible rounded-[14px] border bg-card ${d.kind === 'today' ? 'border-accent/50' : 'border-line'}`}
              >
                <div className="px-3 py-3">
                  <div className="mb-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <span className={`font-medium ${d.kind === 'past' ? 'text-soft' : ''}`}>{weekday}</span>
                    <span className="text-sm text-muted">{fmtDay(d.date, { day: 'numeric', month: 'short' })}</span>
                    {d.kind === 'today' && <Pill tone="accent">Today</Pill>}
                    {d.rows.some((r) => r.preview) && <Pill>Preview</Pill>}
                    <span className="ml-auto text-sm text-muted tabular-nums">
                      {saved.length > 0 && `${done}/${saved.length}`}
                      {extra > 0 && <span className="ml-1.5 text-done">+{extra}</span>}
                      {extra > 0 && <span className="sr-only"> plus {extra} done outside the plan</span>}
                    </span>
                  </div>
                  {saved.length > 0 && <ProgressBar value={done / saved.length} label={`${weekday} progress`} />}
                  {d.rows.length === 0 && <p className="mt-2 text-xs text-muted">{d.kind === 'past' && !d.hasPlan ? 'No plan saved' : 'Nothing scheduled'}</p>}
                </div>

                {d.rows.length > 0 && (
                  <ul className="divide-y divide-line border-t border-line">
                    {d.rows.map((r) => {
                      const topic = r.topicId ? cat.topicById.get(r.topicId) : undefined
                      const track = topic ? trackById.get(topic.trackId) : undefined
                      const title = topic?.title ?? r.label ?? 'Removed topic'
                      const tickable = r.item !== null && d.kind !== 'future'
                      return (
                        <li key={r.key} className={`flex items-start gap-3 px-3 py-2 ${r.preview ? 'opacity-70' : ''}`}>
                          {tickable ? (
                            <span className="-my-1">
                              <Check checked={r.done} label={`Mark "${title}" done on ${weekday}`} onClick={() => run(() => toggleRow(r, d.date))} />
                            </span>
                          ) : (
                            <>
                              <span
                                aria-hidden="true"
                                className={`mt-1.5 size-2 shrink-0 rounded-full ${r.done ? 'bg-done' : 'border border-muted/60'}`}
                                style={!r.done && track ? { borderColor: trackColor(track.sort_order) } : undefined}
                              />
                              <span className="sr-only">{r.preview ? 'Preview:' : r.done ? 'Done:' : 'Not done:'}</span>
                            </>
                          )}
                          <span className="min-w-0 flex-1">
                            {topic ? (
                              <button
                                type="button"
                                onClick={() => actions.onOpen(topic)}
                                className={`text-left hover:underline ${r.done ? 'text-muted line-through decoration-muted/70' : 'text-soft'}`}
                              >
                                {title}
                              </button>
                            ) : (
                              <span className={r.done ? 'text-muted line-through decoration-muted/70' : 'text-soft'}>{title}</span>
                            )}
                            {track && (
                              <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted">
                                {track.name}
                                {topic?.bloom && <Pill>{topic.bloom}</Pill>}
                              </span>
                            )}
                            {r.item && needsSubject(r.label) && (
                              <span className="mt-1 block">
                                <SubjectPicker
                                  label={title}
                                  value={r.item.track_id}
                                  tracks={subjects}
                                  suggested={weakest}
                                  onChange={(trackId) =>
                                    run(async () => {
                                      await setItemTrack(r.item!.id, trackId)
                                      await reload()
                                    })
                                  }
                                />
                              </span>
                            )}
                          </span>
                          {r.item && !r.done && (
                            <span className="-my-1.5 -mr-1">
                              <ItemMenu
                                name={title}
                                defers={defers}
                                minDate={d.kind === 'past' ? today : nextDay}
                                onDefer={(to) =>
                                  run(async () => {
                                    await deferItem(r.item!.id, to)
                                    await reload()
                                  })
                                }
                              />
                            </span>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                )}

                <div className="mt-auto border-t border-line px-3 py-2">
                  {adding === d.date ? (
                    <AddItem
                      options={cat.topics
                        .filter((t) => !t.done && !onDay.has(t.id))
                        .map((t) => ({ id: t.id, text: `${t.title} · ${trackById.get(t.trackId)?.name ?? ''}` }))}
                      onAdd={async (topicId, label) => {
                        try {
                          if (!(await addPlanItem(d.date, topicId, label))) setError(`That topic is already on ${weekday}.`)
                          await reload()
                          setAdding(null)
                        } catch (e) {
                          setError(message(e))
                        }
                      }}
                    />
                  ) : (
                    <button type="button" onClick={() => setAdding(d.date)} className="min-h-10 text-xs font-medium text-accent">
                      + Add to {weekday}
                    </button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>

        <WeeklyReview cat={cat} today={today} onError={actions.onError} />
      </div>
      {drawer}
    </main>
  )
}
