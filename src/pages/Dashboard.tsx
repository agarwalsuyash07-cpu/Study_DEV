import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import ErrorBanner from '../components/ErrorBanner'
import ProgressBar from '../components/ProgressBar'
import { trackColor } from '../components/trackColor'
import { PageHeader } from '../components/ui'
import { loadItems, minutesByDay, weeklyMinutes, type Item } from '../lib/data'
import { todayIST, weekDates } from '../lib/date'
import { fmtMin } from '../lib/format'
import { trackLink } from '../lib/links'
import { heatLevel, heatmapWeeks, streaks } from '../lib/stats'
import { message, useCatalog } from '../lib/useCatalog'

const WEEKS = 26
const HEAT = ['bg-track', 'bg-accent/25', 'bg-accent/50', 'bg-accent/75', 'bg-accent']
const DAY_LABELS = ['Mon', '', 'Wed', '', 'Fri', '', '']

const fmtDate = (date: string, opts: Intl.DateTimeFormatOptions) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString('en-IN', { timeZone: 'UTC', ...opts })

const days = (n: number) => `${n} ${n === 1 ? 'day' : 'days'}`

function Ring({ value, size = 56, color = 'var(--color-accent)' }: { value: number; size?: number; color?: string }) {
  const r = (size - 6) / 2
  const c = 2 * Math.PI * r
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0 -rotate-90" aria-hidden="true">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-track)" strokeWidth="5" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - Math.min(1, Math.max(0, value)))}
        className="transition-[stroke-dashoffset] duration-500"
      />
    </svg>
  )
}

function Card({ title, action, children, className = '' }: { title?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-[14px] border border-line bg-card p-5 ${className}`}>
      {title && (
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-sm font-medium text-soft">{title}</h2>
          {action}
        </div>
      )}
      {children}
    </section>
  )
}

function Kpi({ label, value, sub, visual }: { label: string; value: ReactNode; sub: ReactNode; visual?: ReactNode }) {
  return (
    <Card className="flex items-center gap-4">
      {visual}
      <div className="min-w-0">
        <p className="text-xs text-muted">{label}</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
        <p className="mt-0.5 truncate text-xs text-muted">{sub}</p>
      </div>
    </Card>
  )
}

export default function Dashboard() {
  const { cat, error, setError } = useCatalog()
  const [today] = useState(todayIST)
  const weeks = heatmapWeeks(today, WEEKS)
  const from = weeks[0]![0]!
  const [minutes, setMinutes] = useState<Map<string, number> | null>(null)
  const [items, setItems] = useState<Item[] | null>(null)

  useEffect(() => {
    let cancelled = false
    // loadItems, not ensureDayPlan: viewing the dashboard shouldn't freeze today's plan
    Promise.all([minutesByDay(from, today), loadItems(today)]).then(
      ([m, i]) => {
        if (cancelled) return
        setMinutes(m)
        setItems(i)
      },
      (e: unknown) => {
        if (!cancelled) setError(message(e))
      },
    )
    return () => {
      cancelled = true
    }
  }, [from, today, setError])

  if (!cat || !minutes || !items) {
    return (
      <main>
        <PageHeader title="Dashboard" />
        <div className="px-4 md:px-8">
          <ErrorBanner error={error} onDismiss={() => setError(null)} />
          {!error && <p className="text-muted">Loading dashboard…</p>}
        </div>
      </main>
    )
  }

  const total = cat.topics.length
  const done = cat.topics.filter((t) => t.done)
  const spent = cat.topics.reduce((n, t) => n + t.spentMin, 0)

  const doneByDay = new Map<string, number>()
  for (const t of done) {
    if (!t.doneAt) continue
    const d = todayIST(new Date(t.doneAt))
    doneByDay.set(d, (doneByDay.get(d) ?? 0) + 1)
  }
  const active = new Set([...[...minutes].filter(([, m]) => m > 0).map(([d]) => d), ...doneByDay.keys()])
  const streak = streaks(active, today)

  const weekMin = weekDates(today).reduce((n, d) => n + (minutes.get(d) ?? 0), 0)
  const weekGoal = cat.blocks.reduce((n, b) => n + b.minutes, 0)
  const heatTotal = [...minutes.values()].reduce((n, m) => n + m, 0)

  const todayDone = items.filter((i) => i.done_at !== null).length
  const recent = done
    .filter((t) => t.doneAt)
    .sort((a, b) => b.doneAt!.localeCompare(a.doneAt!))
    .slice(0, 6)
  const trackById = new Map(cat.tracks.map((t) => [t.id, t]))

  return (
    <main>
      <PageHeader
        title="Dashboard"
        action={<span className="text-xs text-muted">{fmtDate(today, { weekday: 'long', day: 'numeric', month: 'long' })}</span>}
      />
      <div className="flex flex-col gap-6 px-4 pb-8 md:px-8">
        <ErrorBanner error={error} onDismiss={() => setError(null)} />

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi
            label="Overall progress"
            value={`${total ? Math.round((done.length / total) * 100) : 0}%`}
            sub={`${done.length} of ${total} topics`}
            visual={<Ring value={total ? done.length / total : 0} />}
          />
          <Kpi label="Time studied" value={fmtMin(spent)} sub={`${fmtMin(heatTotal)} in the last ${WEEKS} weeks`} />
          <Kpi label="Current streak" value={days(streak.current)} sub={`Best: ${days(streak.best)}`} />
          <Kpi
            label="This week"
            value={fmtMin(weekMin)}
            sub={weekGoal ? `of ${fmtMin(weekGoal)} scheduled` : 'No schedule set'}
            visual={<Ring value={weekGoal ? weekMin / weekGoal : 0} color="var(--color-done)" />}
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <Card
            title="Study activity"
            action={
              <span className="flex items-center gap-1.5 text-[11px] text-muted" aria-hidden="true">
                Less
                {HEAT.map((c) => (
                  <span key={c} className={`size-2.5 rounded-[3px] ${c}`} />
                ))}
                More
              </span>
            }
          >
            <div className="overflow-x-auto pb-1">
            <div className="flex min-w-[520px] gap-[3px]">
              <div className="mr-1 flex flex-col gap-[3px] text-[10px] text-muted" aria-hidden="true">
                <span className="h-4" />
                {DAY_LABELS.map((l, i) => (
                  <span key={i} className="flex flex-1 items-center">
                    {l}
                  </span>
                ))}
              </div>
              {weeks.map((week) => (
                <div key={week[0]} className="flex flex-1 flex-col gap-[3px]">
                  {/* month label on the first week that starts in it */}
                  <span className="h-4 text-[10px] whitespace-nowrap text-muted" aria-hidden="true">
                    {Number(week[0]!.slice(8)) <= 7 ? fmtDate(week[0]!, { month: 'short' }) : ''}
                  </span>
                  {week.map((d) => {
                    const m = minutes.get(d) ?? 0
                    const n = doneByDay.get(d) ?? 0
                    const tip = `${fmtDate(d, { day: 'numeric', month: 'short' })}: ${fmtMin(m)} studied, ${n} topic${n === 1 ? '' : 's'} done`
                    return (
                      <span
                        key={d}
                        title={d > today ? undefined : tip}
                        aria-label={d > today ? undefined : tip}
                        className={`aspect-square w-full rounded-[3px] ${d > today ? '' : HEAT[heatLevel(m)]} ${d === today ? 'ring-1 ring-soft' : ''}`}
                      />
                    )
                  })}
                </div>
              ))}
            </div>
            </div>
          </Card>

          <Card title="Today" action={<Link to="/today" className="text-xs text-accent">Open →</Link>}>
            {items.length === 0 ? (
              <p className="text-muted">
                No plan yet.{' '}
                <Link to="/today" className="text-accent underline">
                  Open Today
                </Link>{' '}
                to generate it.
              </p>
            ) : (
              <>
                <div className="mb-3 flex items-end justify-between">
                  <span className="text-xl font-semibold tabular-nums">
                    {todayDone}/{items.length}
                  </span>
                  <span className="text-xs text-muted">{fmtMin(minutes.get(today) ?? 0)} studied</span>
                </div>
                <ProgressBar value={todayDone / items.length} label="Today's plan progress" color="var(--color-done)" />
                <ul className="mt-4 flex flex-col gap-2">
                  {items.slice(0, 5).map((i) => {
                    const t = i.topic_id ? cat.topicById.get(i.topic_id) : undefined
                    const link = t && trackLink(t.trackId)
                    const title = t?.title ?? i.label ?? 'Study block'
                    return (
                      <li key={i.id} className="flex items-center gap-2">
                        <span
                          aria-hidden="true"
                          className={`size-3.5 shrink-0 rounded-full border ${i.done_at ? 'border-done bg-done' : 'border-check'}`}
                        />
                        {link ? (
                          <a
                            href={link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`truncate underline decoration-accent/60 underline-offset-2 hover:text-accent ${i.done_at ? 'text-muted line-through' : ''}`}
                          >
                            {title}
                            <span className="sr-only"> (opens in a new tab)</span>
                          </a>
                        ) : (
                          <span className={`truncate ${i.done_at ? 'text-muted line-through' : ''}`}>{title}</span>
                        )}
                      </li>
                    )
                  })}
                  {items.length > 5 && <li className="text-xs text-muted">+{items.length - 5} more</li>}
                </ul>
              </>
            )}
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <Card title="Track progress" action={<Link to="/tracks" className="text-xs text-accent">All tracks →</Link>}>
            <ul className="grid gap-x-8 gap-y-5 md:grid-cols-2">
              {cat.tracks.map((track) => {
                const ts = cat.topics.filter((t) => t.trackId === track.id)
                const n = ts.filter((t) => t.done).length
                const color = trackColor(track.sort_order)
                const weekly = weeklyMinutes(cat, track.id)
                return (
                  <li key={track.id}>
                    <Link to={`/tracks/${track.id}`} className="group block">
                      <div className="mb-1.5 flex items-center gap-2">
                        <span aria-hidden="true" className="size-2 shrink-0 rounded-full" style={{ background: color }} />
                        <span className="min-w-0 flex-1 truncate font-medium group-hover:text-accent">{track.name}</span>
                        <span className="text-xs text-muted tabular-nums">
                          {n}/{ts.length}
                        </span>
                      </div>
                      <ProgressBar value={ts.length ? n / ts.length : 0} color={color} label={`${track.name} progress`} />
                      <p className="mt-1 text-[11px] text-muted">{weekly ? `${fmtMin(weekly)} / week` : 'Not scheduled'}</p>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </Card>

          <Card title="Recently completed">
            {recent.length === 0 ? (
              <p className="text-muted">Nothing completed yet.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {recent.map((t) => {
                  const track = trackById.get(t.trackId)
                  return (
                    <li key={t.id} className="flex items-start gap-2">
                      <span
                        aria-hidden="true"
                        className="mt-1.5 size-2 shrink-0 rounded-full"
                        style={{ background: track ? trackColor(track.sort_order) : 'var(--color-muted)' }}
                      />
                      <div className="min-w-0">
                        <p className="truncate">{t.title}</p>
                        <p className="text-[11px] text-muted">
                          {track?.name} · {fmtDate(todayIST(new Date(t.doneAt!)), { day: 'numeric', month: 'short' })}
                        </p>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </main>
  )
}
