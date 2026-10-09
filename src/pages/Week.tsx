import { useEffect, useState } from 'react'
import ErrorBanner from '../components/ErrorBanner'
import ProgressBar from '../components/ProgressBar'
import { Check } from '../components/TopicRow'
import { trackColor } from '../components/trackColor'
import { PageHeader, Pill } from '../components/ui'
import { blocksFor, doneAtFor, loadPlansBetween, setItemDoneAt, type Catalog, type Item } from '../lib/data'
import { todayIST, weekDates } from '../lib/date'
import { previewDays, type PlanItem } from '../lib/plan'
import { topicsCompletedOn } from '../lib/stats'
import { showToast } from '../lib/toast'
import { message, useCatalog } from '../lib/useCatalog'

type Row = { key: string; itemId: number | null; blockId: number | null; topicId: string | null; label: string | null; done: boolean }
type Day = { date: string; kind: 'past' | 'today' | 'future'; preview: boolean; rows: Row[] | null }

// deferred originals live on in their new day, so they don't count here
const fromSaved = (items: Item[]): Row[] =>
  items
    .filter((i) => i.deferred_to === null)
    .map((i) => ({ key: `s${i.id}`, itemId: i.id, blockId: i.block_id, topicId: i.topic_id, label: i.label, done: i.done_at !== null }))
const fromPreview = (items: PlanItem[]): Row[] =>
  items.map((i, n) => ({ key: `p${n}`, itemId: null, blockId: i.blockId, topicId: i.topicId, label: i.label, done: false }))

function buildDays(cat: Catalog, dates: string[], today: string, plans: Map<string, Item[]>): Day[] {
  const upcoming = dates.filter((d) => d >= today)
  // saved days reserve their topics so later previews don't repeat them
  const previews = previewDays(
    upcoming.map((d) => {
      const saved = plans.get(d)
      return saved ? { existingTopicIds: saved.flatMap((i) => (i.topic_id ? [i.topic_id] : [])) } : { blocks: blocksFor(cat, d) }
    }),
    cat.topics,
  )
  return dates.map((date) => {
    const kind = date < today ? 'past' : date === today ? 'today' : 'future'
    const saved = plans.get(date)
    const preview = date >= today && !saved ? (previews[upcoming.indexOf(date)] ?? null) : null
    return {
      date,
      kind,
      preview: preview !== null,
      rows: saved ? fromSaved(saved) : preview ? fromPreview(preview) : null,
    }
  })
}

const fmtDay = (date: string, opts: Intl.DateTimeFormatOptions) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString('en-IN', { timeZone: 'UTC', ...opts })

export default function Week() {
  // reload plans after any tick: the DB trigger decides which day's item changed
  const { cat, error, setError, actions } = useCatalog({ onDoneChanged: () => void reloadPlans() })
  const [today] = useState(todayIST)
  const dates = weekDates(today)
  const [plans, setPlans] = useState<Map<string, Item[]> | null>(null)

  const from = dates[0]!
  const to = dates[6]!

  function reloadPlans() {
    return loadPlansBetween(from, to).then(setPlans, (e: unknown) => setError(message(e)))
  }

  async function toggleRow(row: Row, date: string) {
    const topic = row.topicId ? cat?.topicById.get(row.topicId) : undefined
    if (topic) return actions.onSetDoneAt(topic, row.done ? null : doneAtFor(date, today))
    if (row.itemId === null) return
    const itemId = row.itemId
    const prev = plans?.get(date)?.find((i) => i.id === itemId)?.done_at ?? null
    const apply = async (doneAt: string | null) => {
      await setItemDoneAt(itemId, doneAt)
      await reloadPlans()
    }
    await apply(row.done ? null : doneAtFor(date, today))
    showToast({ message: `${row.done ? 'Not done' : 'Done'}: ${row.label ?? ''}`, actions: [{ label: 'Undo', run: () => apply(prev) }] })
  }

  useEffect(() => {
    let cancelled = false
    loadPlansBetween(from, to).then(
      (p) => {
        if (!cancelled) setPlans(p)
      },
      (e: unknown) => {
        if (!cancelled) setError(message(e))
      },
    )
    return () => {
      cancelled = true
    }
  }, [from, to, setError])

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

  const days = buildDays(cat, dates, today, plans)
  const trackById = new Map(cat.tracks.map((t) => [t.id, t]))

  return (
    <main>
      <PageHeader title="This week" />
      <header className="px-4 pb-4 md:px-8">
        <h2 className="pt-1 text-xl font-medium">Monday to Sunday</h2>
        <p className="text-soft">
          {fmtDay(from, { day: 'numeric', month: 'short' })} to {fmtDay(to, { day: 'numeric', month: 'short' })}
        </p>
      </header>
      <ul className="grid items-start gap-4 px-4 pb-8 md:grid-cols-2 md:px-8 xl:grid-cols-4 min-[1700px]:grid-cols-7">
        {error && (
          <li className="col-span-full">
            <ErrorBanner error={error} onDismiss={() => setError(null)} />
          </li>
        )}
        {days.map((d) => {
          const rows = d.rows ?? []
          const done = rows.filter((r) => r.done).length
          const weekday = fmtDay(d.date, { weekday: 'long' })
          const plannedIds = new Set(rows.flatMap((r) => (r.topicId ? [r.topicId] : [])))
          const extra = d.kind === 'future' ? 0 : topicsCompletedOn(cat.topics, d.date).filter((t) => !plannedIds.has(t.id)).length
          return (
            <li key={d.date}>
              <div className={`flex flex-col overflow-hidden rounded-[14px] border bg-card ${d.kind === 'today' ? 'border-accent/50' : 'border-line'}`}>
                <div className="px-3 py-3">
                  <div className="mb-2 flex items-baseline gap-2">
                    <span className={`font-medium ${d.kind === 'past' ? 'text-muted' : ''}`}>{weekday}</span>
                    <span className="text-sm text-muted">{fmtDay(d.date, { day: 'numeric', month: 'short' })}</span>
                    {d.kind === 'today' && <Pill tone="accent">Today</Pill>}
                    {d.preview && <Pill>Preview</Pill>}
                    <span className="ml-auto text-sm text-muted tabular-nums">
                      {d.rows ? `${done}/${rows.length}` : ''}
                      {extra > 0 && <span className="ml-1.5 text-done">+{extra}</span>}
                      {extra > 0 && <span className="sr-only"> plus {extra} done outside the plan</span>}
                    </span>
                  </div>
                  {rows.length > 0 && <ProgressBar value={done / rows.length} label={`${weekday} progress`} />}
                  {rows.length === 0 && (
                    <p className="mt-2 text-xs text-muted">{d.rows === null && d.kind === 'past' ? 'No plan saved' : 'Nothing scheduled'}</p>
                  )}
                </div>
                {rows.length > 0 && (
                  <ul className="divide-y divide-line border-t border-line">
                    {rows.map((r) => {
                      const topic = r.topicId ? cat.topicById.get(r.topicId) : undefined
                      const track = topic ? trackById.get(topic.trackId) : undefined
                      return (
                        <li key={r.key} className="flex items-start gap-3 px-3 py-2.5">
                          {r.itemId !== null && d.kind !== 'future' ? (
                            // saved past/today rows can be ticked: past days are backfilled at noon IST
                            <span className="-my-1">
                              <Check
                                checked={r.done}
                                label={`Mark "${topic?.title ?? r.label ?? ''}" done on ${weekday}`}
                                onClick={() => void toggleRow(r, d.date).catch((e: unknown) => setError(message(e)))}
                              />
                            </span>
                          ) : (
                            <>
                              <span
                                aria-hidden="true"
                                className={`mt-1.5 size-2 shrink-0 rounded-full ${r.done ? 'bg-done' : 'border border-muted/60'}`}
                                style={!r.done && track ? { borderColor: trackColor(track.sort_order) } : undefined}
                              />
                              <span className="sr-only">{r.done ? 'Done:' : 'Not done:'}</span>
                            </>
                          )}
                          <span className="min-w-0 flex-1">
                            <span className={r.done ? 'text-muted line-through decoration-muted/70' : 'text-soft'}>
                              {topic?.title ?? r.label ?? 'Removed topic'}
                            </span>
                            {track && (
                              <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted">
                                {track.name}
                                {topic?.bloom && <Pill>{topic.bloom}</Pill>}
                              </span>
                            )}
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </main>
  )
}
