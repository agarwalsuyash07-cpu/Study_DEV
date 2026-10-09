import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import ErrorBanner from '../components/ErrorBanner'
import TopicRow, { Check } from '../components/TopicRow'
import { trackColor } from '../components/trackColor'
import { MiniProgress, PageHeader, ProgressCard, StatGrid } from '../components/ui'
import { ensureDayPlan, loadCatalog, regenerateDay, setItemDone, type Block, type Item } from '../lib/data'
import { todayIST, weekdayOf } from '../lib/date'
import { message, useCatalog } from '../lib/useCatalog'

const dayLabel = (date: string) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString('en-IN', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' })

type Group = { block: Block | null; items: Item[] }

export default function Today() {
  const [date, setDate] = useState(todayIST)
  const [items, setItems] = useState<Item[]>([])
  const [regenerating, setRegenerating] = useState(false)
  const { cat, setCat, error, setError, actions } = useCatalog({
    autoLoad: false,
    // mirrors the DB trigger for today's items
    onDoneChanged: (topicId, doneAt) =>
      setItems((its) => its.map((i) => (i.topic_id === topicId ? { ...i, done_at: doneAt } : i))),
  })

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const c = await loadCatalog()
      const its = await ensureDayPlan(c, date)
      if (cancelled) return
      setCat(c)
      setItems(its)
    })().catch((e: unknown) => {
      if (!cancelled) setError(message(e))
    })
    return () => {
      cancelled = true
    }
  }, [date, setCat, setError])

  // app left open past midnight IST rolls over to the new day
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') setDate(todayIST())
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  async function toggleItem(item: Item) {
    try {
      const doneAt = await setItemDone(item.id, item.done_at === null)
      setItems((its) => its.map((i) => (i.id === item.id ? { ...i, done_at: doneAt } : i)))
    } catch (e) {
      setError(message(e))
    }
  }

  async function regenerate() {
    if (!cat) return
    setRegenerating(true)
    try {
      setItems(await regenerateDay(cat, date, items))
    } catch (e) {
      setError(message(e))
    } finally {
      setRegenerating(false)
    }
  }

  const groups = useMemo<Group[]>(() => {
    if (!cat) return []
    const blockById = new Map(cat.blocks.map((b) => [b.id, b]))
    const byBlock = new Map<number | null, Item[]>()
    for (const i of items) {
      const key = i.block_id !== null && blockById.has(i.block_id) ? i.block_id : null
      byBlock.set(key, [...(byBlock.get(key) ?? []), i])
    }
    return [...byBlock]
      .map(([id, its]) => ({ block: id === null ? null : (blockById.get(id) ?? null), items: its }))
      .sort((a, b) => (a.block?.sort_order ?? Infinity) - (b.block?.sort_order ?? Infinity))
  }, [cat, items])

  if (!cat) {
    return (
      <main>
        <PageHeader title="Today" />
        <div className="px-4 md:px-8">
          <ErrorBanner error={error} onDismiss={() => setError(null)} />
          {!error && <p className="text-muted">Loading today…</p>}
        </div>
      </main>
    )
  }

  const isDone = (i: Item) => (i.topic_id ? (cat.topicById.get(i.topic_id)?.done ?? false) : i.done_at !== null)
  const doneCount = items.filter(isDone).length
  const allDone = items.length > 0 && doneCount === items.length
  const trackById = new Map(cat.tracks.map((t) => [t.id, t]))
  const hasBlocksToday = cat.blocks.some((b) => b.weekday === weekdayOf(date))

  return (
    <main>
      <PageHeader
        title={dayLabel(date)}
        action={
          hasBlocksToday && (
            <button
              type="button"
              onClick={() => void regenerate()}
              disabled={regenerating}
              className="shrink-0 rounded-lg border border-line bg-raised px-3 py-1.5 text-xs font-medium hover:border-check disabled:opacity-50"
            >
              {regenerating ? 'Regenerating…' : 'Regenerate today'}
            </button>
          )
        }
      />

      <div className="grid items-start gap-6 px-4 pb-8 md:px-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <aside className="flex flex-col gap-4 lg:sticky lg:top-20 lg:order-2">
          {items.length > 0 && (
            <>
              <ProgressCard done={doneCount} total={items.length} label="Today's progress" />
              <StatGrid
                items={[
                  { icon: 'list', value: items.length, label: items.length === 1 ? 'Item' : 'Items' },
                  { icon: 'check', value: doneCount, label: 'Done' },
                ]}
              />
            </>
          )}
          {allDone && (
            <div className="flex items-center gap-3 rounded-[14px] border border-done/30 bg-done/10 px-3 py-3">
              <span className="grid size-8 place-items-center rounded-full bg-done text-bg" aria-hidden="true">
                <svg viewBox="0 0 16 16" className="size-5">
                  <path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <div>
                <p className="font-medium">Done for today</p>
                <p className="text-xs text-soft">Everything planned is ticked off.</p>
              </div>
            </div>
          )}
        </aside>

        <div className="flex min-w-0 flex-col gap-6 lg:order-1">
          <ErrorBanner error={error} onDismiss={() => setError(null)} />

          {items.length === 0 && (
            <p className="text-soft">
              {hasBlocksToday ? 'Every track scheduled today is complete. ' : 'Nothing is scheduled today. '}
              <Link to="/settings" className="text-accent underline">
                Edit schedule
              </Link>
            </p>
          )}

          <div className="grid items-start gap-6 2xl:grid-cols-2">
            {groups.map((g) => {
              const track = g.block?.track_id ? trackById.get(g.block.track_id) : undefined
              const name = track?.name ?? g.block?.label ?? 'Removed block'
              const done = g.items.filter(isDone).length
              return (
                <section key={g.block?.id ?? 'other'} aria-label={name}>
                  <div className="flex items-center gap-2 px-1 pb-2">
                    {track && (
                      <span aria-hidden="true" className="size-2 shrink-0 rounded-full" style={{ background: trackColor(track.sort_order) }} />
                    )}
                    <h3 className="min-w-0 flex-1 truncate font-medium">{name}</h3>
                    <MiniProgress done={done} total={g.items.length} label={`${name} progress`} />
                  </div>
                  <ul className="divide-y divide-line overflow-hidden rounded-[14px] border border-line bg-card">
                    {g.items.map((i) => {
                      const topic = i.topic_id ? cat.topicById.get(i.topic_id) : undefined
                      if (topic) return <TopicRow key={i.id} topic={topic} actions={actions} />
                      return (
                        <li key={i.id} className="flex items-center gap-3 px-3 py-3">
                          <Check checked={i.done_at !== null} label={`Mark "${i.label ?? ''}" done`} onClick={() => void toggleItem(i)} />
                          <span className={i.done_at ? 'text-muted line-through decoration-muted/70' : 'text-soft'}>{i.label}</span>
                        </li>
                      )
                    })}
                  </ul>
                </section>
              )
            })}
          </div>
        </div>
      </div>
    </main>
  )
}
