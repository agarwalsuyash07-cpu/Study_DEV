import { Link, useNavigate } from 'react-router'
import ErrorBanner from '../components/ErrorBanner'
import ProgressBar from '../components/ProgressBar'
import { trackColor } from '../components/trackColor'
import { PageHeader, ProgressCard, StatGrid } from '../components/ui'
import { paceFor, weeklyTopics } from '../lib/data'
import { todayIST } from '../lib/date'
import { fmtPerDay, paceLabel } from '../lib/pace'
import { useCatalog } from '../lib/useCatalog'

const fmtExam = (date: string) => new Date(`${date}T00:00:00Z`).toLocaleDateString('en-IN', { timeZone: 'UTC', day: 'numeric', month: 'short' })

export default function Tracks() {
  const { cat, error, setError } = useCatalog()
  const navigate = useNavigate()
  const today = todayIST()

  const rows = cat
    ? cat.tracks.map((track) => {
        const ts = cat.topics.filter((t) => t.trackId === track.id)
        const pace = paceFor(cat, track.id, today)
        return {
          track,
          pace,
          label: paceLabel(pace, weeklyTopics(cat, track.id)),
          s: { total: ts.length, doneCount: ts.filter((t) => t.done).length },
        }
      })
    : []
  const done = rows.reduce((n, r) => n + r.s.doneCount, 0)
  const total = rows.reduce((n, r) => n + r.s.total, 0)
  const th = 'px-4 py-3 font-normal'

  return (
    <main>
      <PageHeader title="Tracks" />
      <div className="flex flex-col gap-6 px-4 pb-8 md:px-8">
        <ErrorBanner error={error} onDismiss={() => setError(null)} />
        {!cat && !error && <p className="text-muted">Loading tracks…</p>}
        {cat && (
          <>
            <div className="grid items-center gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
              <ProgressCard done={done} total={total} label="All tracks progress" />
              <StatGrid
                cols="grid-cols-2 sm:grid-cols-4"
                items={[
                  { icon: 'book', value: cat.tracks.length, label: 'Tracks' },
                  { icon: 'list', value: total, label: 'Topics' },
                  { icon: 'check', value: done, label: 'Done' },
                  { icon: 'flag', value: total - done, label: 'Left' },
                ]}
              />
            </div>

            <div className="overflow-x-auto rounded-[14px] border border-line">
              <table className="w-full min-w-[880px] text-left">
                <thead className="bg-card text-xs text-muted">
                  <tr className="border-b border-line">
                    <th className={th}>Track</th>
                    <th className={`${th} w-[22%]`}>Progress</th>
                    <th className={`${th} text-right`}>Topics</th>
                    <th className={`${th} text-right`}>Left</th>
                    <th className={`${th} text-right`}>Exam</th>
                    <th className={`${th} text-right`}>Need / day</th>
                    <th className={`${th} text-right`}>7-day pace</th>
                    <th className={th}>Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {rows.map(({ track, pace, label, s }) => {
                    const pct = s.total ? Math.round((s.doneCount / s.total) * 100) : 0
                    return (
                      <tr
                        key={track.id}
                        onClick={() => navigate(`/tracks/${track.id}`)}
                        className="cursor-pointer tabular-nums transition-colors hover:bg-raised/60"
                      >
                        <td className="px-4 py-3.5">
                          <Link to={`/tracks/${track.id}`} className="flex items-center gap-2 font-medium" onClick={(e) => e.stopPropagation()}>
                            <span aria-hidden="true" className="size-2 shrink-0 rounded-full" style={{ background: trackColor(track.sort_order) }} />
                            {track.name}
                          </Link>
                          {track.course_code && <span className="ml-4 text-xs text-muted">{track.course_code}</span>}
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-3">
                            <ProgressBar value={s.total ? s.doneCount / s.total : 0} label={`${track.name} progress`} />
                            <span className="w-10 shrink-0 text-right text-xs font-semibold">{pct}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-right text-soft">
                          {s.doneCount}/{s.total}
                        </td>
                        <td className="px-4 py-3.5 text-right text-soft">{s.total - s.doneCount}</td>
                        <td className="px-4 py-3.5 text-right text-soft">
                          {track.exam_date ? (
                            <>
                              {fmtExam(track.exam_date)}
                              {pace.daysLeft !== null && pace.daysLeft > 0 && <span className="block text-xs text-muted">{pace.daysLeft} days</span>}
                            </>
                          ) : (
                            <span className="text-muted">Not set</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-right text-soft">{pace.neededPerDay !== null ? fmtPerDay(pace.neededPerDay) : <span className="text-muted">n/a</span>}</td>
                        <td className="px-4 py-3.5 text-right text-soft">{fmtPerDay(pace.recentPerDay)}</td>
                        <td className={`px-4 py-3.5 text-xs ${label.tone === 'warn' ? 'text-warn' : label.tone === 'done' ? 'text-done' : 'text-muted'}`}>
                          {label.text}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </main>
  )
}
