import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react'
import { Link } from 'react-router'
import ErrorBanner from '../components/ErrorBanner'
import { AddItem, ItemMenu, SubjectPicker } from '../components/PlanControls'
import WeeklyReview from '../components/WeeklyReview'
import TopicRow, { Check } from '../components/TopicRow'
import { trackColor } from '../components/trackColor'
import ProgressBar from '../components/ProgressBar'
import { ConfirmDialog, fmtMinutes, MiniProgress, PageHeader, Pill, ProgressCard, RevisionDueChip, StatGrid } from '../components/ui'
import {
  addPlanItem,
  budgetFor,
  deferItem,
  ensureDayPlan,
  loadCatalog,
  loadItems,
  loadPastUndone,
  needsSubject,
  previewRegeneration,
  revisionsDue,
  saveRegeneration,
  setItemDoneAt,
  setItemOrder,
  setItemTrack,
  toDayItem,
  type Block,
  type Item,
} from '../lib/data'
import { addDays, todayIST, weekdayOf } from '../lib/date'
import { overdueItems, reorderGroup } from '../lib/plan'
import { weakestTrack } from '../lib/review'
import { doneDay, topicsCompletedOn } from '../lib/stats'
import { showToast } from '../lib/toast'
import { message, useCatalog } from '../lib/useCatalog'

const dayLabel = (date: string) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString('en-IN', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' })
const shortDay = (date: string) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString('en-IN', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' })

type Group = { key: string; block: Block | null; items: Item[] }

export default function Today() {
  const [date, setDate] = useState(todayIST)
  const [items, setItems] = useState<Item[]>([])
  const [pastUndone, setPastUndone] = useState<Item[]>([])
  const [regen, setRegen] = useState<ReturnType<typeof previewRegeneration> | null>(null)
  const [saving, setSaving] = useState(false)
  const [ignoreBudget, setIgnoreBudget] = useState(false)
  const dragFrom = useRef<{ group: string; index: number } | null>(null)
  const { cat, setCat, error, setError, actions, drawer } = useCatalog({
    autoLoad: false,
    // mirrors the DB trigger: the item on the completion day follows the topic
    onDoneChanged: (topicId, doneAt) =>
      setItems((its) =>
        its.map((i) => (i.topic_id === topicId && i.deferred_to === null && (doneAt === null || doneDay(doneAt) === i.date) ? { ...i, done_at: doneAt } : i)),
      ),
  })

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const c = await loadCatalog()
      const [its, past] = await Promise.all([ensureDayPlan(c, date), loadPastUndone(date)])
      if (cancelled) return
      setCat(c)
      setItems(its)
      setPastUndone(past)
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

  async function reload() {
    const [its, past] = await Promise.all([loadItems(date), loadPastUndone(date)])
    setItems(its)
    setPastUndone(past)
  }

  // reports failures in the banner instead of letting them reject unhandled
  function run(fn: () => Promise<void>) {
    fn().catch((e: unknown) => setError(message(e)))
  }

  async function toggleItem(item: Item) {
    const prev = item.done_at
    const apply = async (doneAt: string | null) => {
      await setItemDoneAt(item.id, doneAt)
      setItems((its) => its.map((i) => (i.id === item.id ? { ...i, done_at: doneAt } : i)))
    }
    const next = prev === null ? new Date().toISOString() : null
    await apply(next)
    showToast({ message: `${next ? 'Done' : 'Not done'}: ${item.label ?? ''}`, actions: [{ label: 'Undo', run: () => apply(prev) }] })
  }

  async function defer(itemId: number, to: string) {
    await deferItem(itemId, to)
    await reload()
  }

  async function add(topicId: string | null, label: string | null) {
    try {
      if (!(await addPlanItem(date, topicId, label))) setError("That topic is already on today's list.")
      await reload()
    } catch (e) {
      setError(message(e))
    }
  }

  async function move(group: Group, from: number, to: number) {
    const updates = reorderGroup(group.items.map((i) => ({ id: i.id, sortOrder: i.sort_order })), from, to)
    if (updates.length === 0) return
    const next = new Map(updates.map((u) => [u.id, u.sortOrder]))
    // optimistic; a failed save reloads the real order
    setItems((its) => its.map((i) => (next.has(i.id) ? { ...i, sort_order: next.get(i.id)! } : i)).sort((a, b) => a.sort_order - b.sort_order))
    try {
      await setItemOrder(updates)
    } catch (e) {
      setError(message(e))
      await reload()
    }
  }

  async function confirmRegenerate() {
    if (!regen) return
    setSaving(true)
    try {
      setItems(await saveRegeneration(date, regen.items))
      setRegen(null)
    } catch (e) {
      setError(message(e))
    } finally {
      setSaving(false)
    }
  }

  const visible = useMemo(() => items.filter((i) => i.deferred_to === null), [items])

  const groups = useMemo<Group[]>(() => {
    if (!cat) return []
    const blockById = new Map(cat.blocks.map((b) => [b.id, b]))
    const byKey = new Map<string, Group>()
    for (const i of visible) {
      const block = i.block_id !== null ? (blockById.get(i.block_id) ?? null) : null
      const key = block ? `b${block.id}` : 'added'
      const g = byKey.get(key) ?? { key, block, items: [] }
      g.items.push(i)
      byKey.set(key, g)
    }
    // hand-added and orphaned items go last
    return [...byKey.values()].sort((a, b) => (a.block?.sort_order ?? Infinity) - (b.block?.sort_order ?? Infinity))
  }, [cat, visible])

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

  const tomorrow = addDays(date, 1)
  const isDone = (i: Item) => toDayItem(cat, i).done
  const doneCount = visible.filter(isDone).length
  const allDone = visible.length > 0 && doneCount === visible.length
  const trackById = new Map(cat.tracks.map((t) => [t.id, t]))
  const hasBlocksToday = cat.blocks.some((b) => b.weekday === weekdayOf(date))
  const onToday = new Set(items.flatMap((i) => (i.topic_id ? [i.topic_id] : [])))
  const overdue = overdueItems(
    pastUndone.map((i) => toDayItem(cat, i)),
    date,
    (id) => cat.topicById.get(id)?.done ?? false,
    onToday,
  )
  const deferredCount = items.length - visible.length
  const planned = new Set(visible.flatMap((i) => (i.topic_id ? [i.topic_id] : [])))
  // completed today from anywhere (track page, overdue list) but not part of today's plan
  const alsoDone = topicsCompletedOn(cat.topics, date).filter((t) => !planned.has(t.id))
  const addOptions = cat.topics
    .filter((t) => !t.done && !onToday.has(t.id))
    .map((t) => ({ id: t.id, text: `${t.title} · ${trackById.get(t.trackId)?.name ?? ''}` }))
  const titleOf = (i: { topicId: string | null; label: string | null }) =>
    i.topicId ? (cat.topicById.get(i.topicId)?.title ?? 'Removed topic') : (i.label ?? 'Study block')
  const weakest = weakestTrack(
    cat.tracks.map((t) => ({ id: t.id, counted: t.count_in_overall })),
    cat.topics,
  )
  const nothingChanges = regen !== null && regen.removed.length === 0 && regen.added.length === 0
  const budget = budgetFor(cat, date)
  const minutesOf = (i: Item) => (i.topic_id ? (cat.topicById.get(i.topic_id)?.estMinutes ?? 0) : 0)
  const plannedMinutes = visible.reduce((n, i) => n + minutesOf(i), 0)
  const leftMinutes = visible.reduce((n, i) => (isDone(i) ? n : n + minutesOf(i)), 0)
  const overBy = plannedMinutes - budget

  function openRegenerate(override: boolean) {
    setIgnoreBudget(override)
    setRegen(previewRegeneration(cat!, date, items, override))
  }

  function dragProps(g: Group, index: number) {
    return {
      draggable: true,
      onDragStart: (e: DragEvent<HTMLLIElement>) => {
        dragFrom.current = { group: g.key, index }
        e.dataTransfer.effectAllowed = 'move'
      },
      onDragOver: (e: DragEvent<HTMLLIElement>) => {
        if (dragFrom.current?.group === g.key) e.preventDefault()
      },
      onDrop: (e: DragEvent<HTMLLIElement>) => {
        e.preventDefault()
        const from = dragFrom.current
        dragFrom.current = null
        if (from?.group === g.key) void move(g, from.index, index)
      },
    }
  }

  function renderItem(g: Group, i: Item, index: number) {
    const topic = i.topic_id ? cat!.topicById.get(i.topic_id) : undefined
    const name = topic?.title ?? i.label ?? 'item'
    const menu = (
      <ItemMenu
        name={name}
        onMove={(dir) => void move(g, index, index + dir)}
        canUp={index > 0}
        canDown={index < g.items.length - 1}
        defers={[{ label: 'Defer to tomorrow', date: tomorrow }]}
        minDate={tomorrow}
        onDefer={(to) => run(() => defer(i.id, to))}
      />
    )
    if (topic) {
      return (
        <TopicRow
          key={i.id}
          topic={topic}
          actions={actions}
          extra={menu}
          rowProps={dragProps(g, index)}
          note={i.manual ? <Pill>Added</Pill> : undefined}
        />
      )
    }
    return (
      <li key={i.id} {...dragProps(g, index)} className="flex items-center gap-3 px-3 py-2.5">
        <span className="py-0.5">
          <Check checked={i.done_at !== null} label={`Mark "${i.label ?? ''}" done`} onClick={() => run(() => toggleItem(i))} />
        </span>
        <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
          <span className={i.done_at ? 'text-muted line-through decoration-muted/70' : 'text-soft'}>{i.label}</span>
          {needsSubject(i.label) && (
            <SubjectPicker
              label={i.label ?? ''}
              value={i.track_id}
              tracks={cat!.tracks.filter((t) => t.count_in_overall)}
              suggested={weakest}
              onChange={(trackId) =>
                run(async () => {
                  await setItemTrack(i.id, trackId)
                  setItems((its) => its.map((x) => (x.id === i.id ? { ...x, track_id: trackId } : x)))
                })
              }
            />
          )}
        </span>
        <span className="-my-1.5 -mr-1">{menu}</span>
      </li>
    )
  }

  return (
    <main>
      <PageHeader
        title={dayLabel(date)}
        action={
          hasBlocksToday && (
            <button
              type="button"
              onClick={() => openRegenerate(false)}
              className="shrink-0 rounded-lg border border-line bg-raised px-3 py-1.5 text-xs font-medium hover:border-check"
            >
              Regenerate today
            </button>
          )
        }
      />

      <div className="grid items-start gap-6 px-4 pb-8 md:px-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <aside className="flex flex-col gap-4 lg:sticky lg:top-20 lg:order-2">
          {visible.length > 0 && (
            <>
              <ProgressCard done={doneCount} total={visible.length} label="Today's progress" />
              <StatGrid
                items={[
                  { icon: 'list', value: visible.length, label: visible.length === 1 ? 'Item' : 'Items' },
                  { icon: 'check', value: doneCount, label: 'Done' },
                  { icon: 'flag', value: overdue.length, label: 'Overdue', tone: overdue.length ? 'warn' : undefined },
                  { icon: 'list', value: deferredCount, label: 'Deferred' },
                  { icon: 'check', value: alsoDone.length, label: 'Also done' },
                ]}
              />
            </>
          )}
          {visible.length > 0 && (
            <div className={`rounded-[14px] border px-3 py-3 ${overBy > 0 ? 'border-warn/40 bg-warn/10' : 'border-line bg-card'}`}>
              <div className="mb-2 flex items-end justify-between">
                <span className="text-xl font-semibold tabular-nums">{fmtMinutes(leftMinutes)}</span>
                <span className="text-xs text-soft">left to do</span>
              </div>
              <ProgressBar
                value={budget ? Math.min(1, plannedMinutes / budget) : 1}
                label="Planned time against today's budget"
                color={overBy > 0 ? 'var(--color-warn)' : undefined}
              />
              <p className="mt-2 text-xs text-soft tabular-nums">
                {fmtMinutes(plannedMinutes)} planned of {fmtMinutes(budget)} budget
              </p>
              {overBy > 0 && (
                <p role="status" className="mt-1 text-xs text-warn">
                  Over by {fmtMinutes(overBy)}. Defer something, or raise today's budget in{' '}
                  <Link to="/settings" className="underline">
                    Settings
                  </Link>
                  .
                </p>
              )}
            </div>
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
          <div>
            <RevisionDueChip count={revisionsDue(cat, date)} />
          </div>

          {overdue.length > 0 && (
            <section aria-labelledby="overdue-heading">
              <div className="flex items-center gap-2 px-1 pb-2">
                <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-warn" />
                <h3 id="overdue-heading" className="min-w-0 flex-1 truncate font-medium">
                  Overdue
                </h3>
                <span className="text-[11px] text-warn tabular-nums">{overdue.length}</span>
              </div>
              <ul className="divide-y divide-line rounded-[14px] border border-warn/30 bg-card">
                {overdue.map((o) => {
                  const topic = cat.topicById.get(o.topicId!)
                  if (!topic) return null
                  return (
                    <TopicRow
                      key={o.id}
                      topic={topic}
                      actions={actions}
                      note={<span className="text-warn">from {shortDay(o.date)}</span>}
                      extra={
                        <ItemMenu
                          name={topic.title}
                          defers={[
                            { label: 'Do it today', date },
                            { label: 'Defer to tomorrow', date: tomorrow },
                          ]}
                          minDate={date}
                          onDefer={(to) => run(() => defer(o.id, to))}
                        />
                      }
                    />
                  )
                })}
              </ul>
            </section>
          )}

          {visible.length === 0 && (
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
              const name = track?.name ?? g.block?.label ?? 'Added'
              const done = g.items.filter(isDone).length
              return (
                <section key={g.key} aria-label={name}>
                  <div className="flex items-center gap-2 px-1 pb-2">
                    {track && (
                      <span aria-hidden="true" className="size-2 shrink-0 rounded-full" style={{ background: trackColor(track.sort_order) }} />
                    )}
                    <h3 className="min-w-0 flex-1 truncate font-medium">{name}</h3>
                    <MiniProgress done={done} total={g.items.length} label={`${name} progress`} />
                  </div>
                  {/* no overflow-hidden: row menus must be able to open past the card edge */}
                  <ul className="divide-y divide-line rounded-[14px] border border-line bg-card">{g.items.map((i, n) => renderItem(g, i, n))}</ul>
                </section>
              )
            })}
          </div>

          {alsoDone.length > 0 && (
            <section aria-labelledby="also-done-heading">
              <div className="flex items-center gap-2 px-1 pb-2">
                <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-done" />
                <h3 id="also-done-heading" className="min-w-0 flex-1 truncate font-medium">
                  Also done today
                </h3>
                <span className="text-[11px] text-muted tabular-nums">{alsoDone.length}</span>
              </div>
              <ul className="divide-y divide-line rounded-[14px] border border-line bg-card">
                {alsoDone.map((t) => (
                  <TopicRow key={t.id} topic={t} actions={actions} />
                ))}
              </ul>
            </section>
          )}

          <AddItem options={addOptions} onAdd={add} />

          {/* Sunday: the weekly review lives next to the "Weekly review" checklist item */}
          {weekdayOf(date) === 0 && <WeeklyReview cat={cat} today={date} onError={actions.onError} />}
        </div>
      </div>

      <ConfirmDialog
        open={regen !== null}
        title="Regenerate today?"
        confirmLabel="Regenerate"
        confirmDisabled={nothingChanges}
        busy={saving}
        onConfirm={() => void confirmRegenerate()}
        onCancel={() => setRegen(null)}
      >
        <label className="mb-3 flex min-h-10 items-center gap-2 text-soft">
          <input
            type="checkbox"
            checked={ignoreBudget}
            onChange={(e) => openRegenerate(e.target.checked)}
            className="size-4 accent-[var(--color-accent)]"
          />
          Ignore today's {fmtMinutes(budget)} time budget
        </label>
        {regen &&
          (nothingChanges ? (
            <p className="text-soft">Nothing would change: today already matches your schedule.</p>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-soft">Done, added and deferred items stay. Overdue items aren't touched.</p>
              {regen.removed.length > 0 && (
                <div>
                  <h3 className="text-xs text-muted">Removed ({regen.removed.length})</h3>
                  <ul className="mt-1 flex flex-col gap-1">
                    {regen.removed.map((r) => (
                      <li key={r.id} className="text-red-300">
                        <span aria-hidden="true">− </span>
                        <span className="sr-only">Removed: </span>
                        {titleOf(r)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {regen.added.length > 0 && (
                <div>
                  <h3 className="text-xs text-muted">Added ({regen.added.length})</h3>
                  <ul className="mt-1 flex flex-col gap-1">
                    {regen.added.map((a) => (
                      <li key={`${a.blockId}-${a.topicId ?? a.label}`} className="text-done">
                        <span aria-hidden="true">+ </span>
                        <span className="sr-only">Added: </span>
                        {titleOf(a)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
      </ConfirmDialog>
      {drawer}
    </main>
  )
}
