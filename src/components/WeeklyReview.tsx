import { useEffect, useId, useRef, useState } from 'react'
import { HISTORY_START, loadPlansBetween, loadWeeklyReview, saveWeeklyReview, streakFor, weeklyTopics, type Catalog, type Item } from '../lib/data'
import { weekDates } from '../lib/date'
import { weeklySummary } from '../lib/review'
import ProgressBar from './ProgressBar'
import { shortTrackName, trackColor } from './trackColor'

const fmtDay = (date: string) => new Date(`${date}T00:00:00Z`).toLocaleDateString('en-IN', { timeZone: 'UTC', day: 'numeric', month: 'short' })

/** Sunday review: this week's numbers, computed live, plus a reflection saved with a snapshot of them. */
export default function WeeklyReview({ cat, today, onError }: { cat: Catalog; today: string; onError: (e: unknown) => void }) {
  const week = weekDates(today)
  const weekStart = week[0]!
  const [history, setHistory] = useState<Map<string, Item[]> | null>(null)
  const [reflection, setReflection] = useState<string | null>(null)
  const [savedText, setSavedText] = useState('')
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const id = useId()
  // callers may pass an inline callback; keep it out of the load effect's deps
  const onErrorRef = useRef(onError)
  useEffect(() => {
    onErrorRef.current = onError
  })

  useEffect(() => {
    let cancelled = false
    Promise.all([loadPlansBetween(HISTORY_START, today), loadWeeklyReview(weekStart)]).then(
      ([plans, text]) => {
        if (cancelled) return
        setHistory(plans)
        setReflection(text)
        setSavedText(text)
      },
      (e: unknown) => {
        if (!cancelled) onErrorRef.current(e)
      },
    )
    return () => {
      cancelled = true
    }
  }, [today, weekStart])

  if (!history || reflection === null) {
    return <section className="rounded-[14px] border border-line bg-card p-4 text-muted">Loading weekly review…</section>
  }

  const summary = weeklySummary({
    week,
    today,
    tracks: cat.tracks
      .map((t) => ({ id: t.id, name: shortTrackName(t.name), weekly: weeklyTopics(cat, t.id) }))
      .filter((t) => t.weekly > 0),
    topics: cat.topics,
    // a past item counts as missed when it wasn't ticked on its own day
    plans: new Map(week.map((d) => [d, (history.get(d) ?? []).map((i) => ({ done: i.done_at !== null, deferred: i.deferred_to !== null }))])),
    streak: streakFor(cat, history, today).current,
  })

  async function save() {
    if (reflection === null || reflection === savedText) return
    setState('saving')
    try {
      await saveWeeklyReview(weekStart, reflection, summary)
      setSavedText(reflection)
      setState('saved')
    } catch (e) {
      setState('error')
      onError(e)
    }
  }

  const stats = [
    { label: 'Topics done', value: summary.topicsDone },
    { label: 'Missed', value: summary.missed, warn: summary.missed > 0 },
    { label: 'Streak', value: `${summary.streak} ${summary.streak === 1 ? 'day' : 'days'}` },
    { label: 'Revisions', value: summary.revisionsDone },
  ]
  const trackById = new Map(cat.tracks.map((t) => [t.id, t]))

  return (
    <section aria-labelledby={`${id}-h`} className="rounded-[14px] border border-accent/40 bg-card p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id={`${id}-h`} className="text-base font-medium">
          Weekly review
        </h2>
        <span className="text-xs text-muted">
          {fmtDay(week[0]!)} to {fmtDay(week[6]!)}
        </span>
      </div>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-lg bg-raised px-3 py-2">
            <dt className="text-xs text-muted">{s.label}</dt>
            <dd className={`text-lg font-semibold tabular-nums ${s.warn ? 'text-warn' : ''}`}>{s.value}</dd>
          </div>
        ))}
      </dl>

      {summary.perTrack.length > 0 && (
        <ul className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2">
          {summary.perTrack.map((t) => {
            const track = trackById.get(t.id)
            return (
              <li key={t.id}>
                <div className="mb-1 flex items-center gap-2 text-sm">
                  <span aria-hidden="true" className="size-2 rounded-full" style={{ background: track ? trackColor(track.sort_order) : undefined }} />
                  <span className="min-w-0 flex-1 truncate">{t.name}</span>
                  <span className={`text-xs tabular-nums ${t.done >= t.planned ? 'text-done' : 'text-muted'}`}>
                    {t.done}/{t.planned}
                  </span>
                </div>
                <ProgressBar value={t.planned ? t.done / t.planned : 0} label={`${t.name}: ${t.done} of ${t.planned} planned topics this week`} />
              </li>
            )
          })}
        </ul>
      )}

      <div className="mt-4 flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between">
          <label htmlFor={id} className="text-xs text-muted">
            Reflection
          </label>
          <span aria-live="polite" className={`text-xs ${state === 'error' ? 'text-red-300' : 'text-muted'}`}>
            {state === 'saving' ? 'Saving…' : state === 'saved' ? 'Saved' : state === 'error' ? "Couldn't save" : ''}
          </span>
        </div>
        <textarea
          id={id}
          rows={4}
          maxLength={10000}
          value={reflection}
          onChange={(e) => {
            setReflection(e.target.value)
            setState('idle')
          }}
          onBlur={() => void save()}
          placeholder="What went well? What slipped, and what will you change next week?"
          className="resize-y rounded-lg border border-line bg-raised px-3 py-2 placeholder:text-muted focus-visible:border-accent"
        />
      </div>
    </section>
  )
}
