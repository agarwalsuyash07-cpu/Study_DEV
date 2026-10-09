import { useEffect, useId, useRef, useState } from 'react'
import { BLOOM_LEVELS, PRACTICE_LEVELS } from '../lib/bloom'
import type { Topic, TopicPatch, Track } from '../lib/data'
import { Markdown, safeUrl } from '../lib/markdown'
import type { ReviewState } from '../lib/revision'
import ConfidencePicker from './ConfidencePicker'
import type { TopicActions } from './TopicRow'
import { trackColor } from './trackColor'
import { fmtMinutes } from './ui'

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric' })
const fmtDay = (date: string) => new Date(`${date}T00:00:00Z`).toLocaleDateString('en-IN', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' })

const field = 'rounded-lg border border-line bg-raised px-2.5 py-2 outline-none focus-visible:border-accent'
type SaveState = 'idle' | 'saving' | 'saved' | 'error'

/** Side panel (full screen on phones) with everything about one topic. Every field saves itself. */
export default function TopicDrawer({
  topic,
  track,
  review,
  actions,
  onClose,
}: {
  topic: Topic
  track: Track | undefined
  review: ReviewState | null
  actions: TopicActions
  onClose: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const [notes, setNotes] = useState(topic.notes)
  const [tab, setTab] = useState<'write' | 'preview'>(topic.notes ? 'preview' : 'write')
  const [est, setEst] = useState(topic.estOverride === null ? '' : String(topic.estOverride))
  const [link, setLink] = useState('')
  const [linkError, setLinkError] = useState<string | null>(null)
  const [state, setState] = useState<SaveState>('idle')
  const ids = { bloom: useId(), est: useId(), notes: useId(), link: useId(), practice: useId() }

  // mounted only while open
  useEffect(() => {
    ref.current?.showModal()
  }, [])

  async function save(fn: () => Promise<void>) {
    setState('saving')
    try {
      await fn()
      setState('saved')
    } catch (e) {
      setState('error')
      actions.onError(e)
    }
  }
  const update = (patch: TopicPatch) => save(() => actions.onUpdate(topic, patch))

  function saveNotes() {
    if (notes !== topic.notes) void update({ notes })
  }

  function saveEstimate() {
    const t = est.trim()
    const next = t === '' ? null : Number(t)
    if (next !== null && (!Number.isInteger(next) || next < 1 || next > 600)) {
      setEst(topic.estOverride === null ? '' : String(topic.estOverride))
      return
    }
    if (next !== topic.estOverride) void update({ estOverride: next })
  }

  function addLink() {
    const url = link.trim()
    if (!safeUrl(url)) {
      setLinkError('Enter a full http(s) link, e.g. https://example.com')
      return
    }
    setLinkError(null)
    setLink('')
    if (!topic.links.includes(url)) void update({ links: [...topic.links, url] })
  }

  function close() {
    // unsaved notes are saved on the way out
    saveNotes()
    onClose()
  }

  const practice = topic.bloom !== null && PRACTICE_LEVELS.includes(topic.bloom)

  return (
    <dialog
      ref={ref}
      onClose={close}
      aria-labelledby="drawer-title"
      className="my-0 mr-0 ml-auto h-dvh max-h-none w-full max-w-md border-l border-line bg-card p-0 text-text backdrop:bg-black/50"
    >
      <div className="flex h-full flex-col">
        <header className="flex items-start gap-3 border-b border-line px-4 py-3">
          <div className="min-w-0 flex-1">
            <h2 id="drawer-title" className="text-base leading-snug font-medium">
              {topic.title}
            </h2>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-muted">
              {track && <span aria-hidden="true" className="size-2 rounded-full" style={{ background: trackColor(track.sort_order) }} />}
              {track?.name} · {topic.moduleName}
            </p>
          </div>
          <span aria-live="polite" className={`pt-1 text-xs ${state === 'error' ? 'text-red-300' : 'text-muted'}`}>
            {state === 'saving' ? 'Saving…' : state === 'saved' ? 'Saved' : state === 'error' ? "Couldn't save" : ''}
          </span>
          <button type="button" aria-label="Close" onClick={() => ref.current?.close()} className="-mt-1 -mr-2 grid size-10 place-items-center rounded-lg text-soft hover:text-text">
            <svg viewBox="0 0 16 16" className="size-4" aria-hidden="true">
              <path d="M4 4l8 8M12 4l-8 8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-4 py-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-soft">{topic.doneAt ? `Done ${fmtDate(topic.doneAt)}` : 'Not done yet'}</p>
            <button
              type="button"
              aria-pressed={topic.revision}
              onClick={() => void save(() => actions.onToggleStar(topic))}
              className={`flex min-h-10 items-center gap-2 rounded-lg border px-3 ${topic.revision ? 'border-warn/40 text-warn' : 'border-line text-soft'}`}
            >
              <svg viewBox="0 0 20 20" className="size-4" aria-hidden="true">
                <path
                  d="M10 2.8l2.2 4.6 5 .7-3.6 3.5.9 5-4.5-2.4-4.5 2.4.9-5L2.8 8.1l5-.7z"
                  fill={topic.revision ? 'currentColor' : 'none'}
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinejoin="round"
                />
              </svg>
              {topic.revision ? 'Starred' : 'Star for revision'}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor={ids.bloom} className="text-xs text-muted">
                Bloom level
              </label>
              <select
                id={ids.bloom}
                value={topic.bloom ?? ''}
                onChange={(e) => void update({ bloom: e.target.value || null })}
                className={field}
              >
                <option value="">None</option>
                {BLOOM_LEVELS.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor={ids.est} className="text-xs text-muted">
                Estimate (min)
              </label>
              <input
                id={ids.est}
                type="number"
                inputMode="numeric"
                min={1}
                max={600}
                placeholder={`${topic.estDerived} (auto)`}
                value={est}
                onChange={(e) => setEst(e.target.value)}
                onBlur={saveEstimate}
                onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                className={`${field} tabular-nums placeholder:text-muted`}
              />
            </div>
          </div>

          {practice && (
            <label htmlFor={ids.practice} className="flex min-h-10 items-center gap-3 text-soft">
              <input
                id={ids.practice}
                type="checkbox"
                checked={topic.practiceDone}
                onChange={(e) => void update({ practiceDone: e.target.checked })}
                className="size-5 accent-[var(--color-done)]"
              />
              Practice problems done
            </label>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs text-muted">Confidence</span>
            <ConfidencePicker
              label={`Confidence for "${topic.title}"`}
              value={topic.confidence}
              onChange={(c) => void save(() => actions.onSetConfidence(topic, c))}
            />
          </div>

          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-xs text-muted">Last reviewed</dt>
              <dd className="text-soft">{topic.lastReviewedAt ? fmtDate(topic.lastReviewedAt) : 'Never'}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Next review</dt>
              <dd className="text-soft">{review?.dueDate ? fmtDay(review.dueDate) : topic.done ? 'Finished' : 'After you complete it'}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Time</dt>
              <dd className="text-soft">~{fmtMinutes(topic.estMinutes)}</dd>
            </div>
          </dl>

          <section aria-labelledby={`${ids.notes}-h`} className="flex flex-col gap-2">
            <div className="flex items-center gap-1">
              <h3 id={`${ids.notes}-h`} className="flex-1 text-xs text-muted">
                Notes
              </h3>
              <div role="tablist" aria-label="Notes view" className="flex rounded-lg border border-line text-xs">
                {(['write', 'preview'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    role="tab"
                    aria-selected={tab === t}
                    onClick={() => {
                      if (t === 'preview') saveNotes()
                      setTab(t)
                    }}
                    className={`min-h-10 px-3 capitalize ${tab === t ? 'bg-raised text-text' : 'text-soft'}`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            {tab === 'write' ? (
              <>
                <label htmlFor={ids.notes} className="sr-only">
                  Notes in Markdown
                </label>
                <textarea
                  id={ids.notes}
                  rows={8}
                  maxLength={20000}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  onBlur={saveNotes}
                  placeholder="Markdown: # heading, **bold**, - list, `code`, [link](https://…)"
                  className={`${field} resize-y font-mono text-[13px] leading-relaxed placeholder:text-muted`}
                />
              </>
            ) : (
              <div className="md min-h-20 rounded-lg border border-line bg-raised px-3 py-2">
                {notes.trim() ? <Markdown source={notes} /> : <p className="text-muted">No notes yet.</p>}
              </div>
            )}
          </section>

          <section aria-labelledby={`${ids.link}-h`} className="flex flex-col gap-2">
            <h3 id={`${ids.link}-h`} className="text-xs text-muted">
              Links and resources
            </h3>
            {topic.links.length > 0 && (
              <ul className="flex flex-col divide-y divide-line rounded-lg border border-line">
                {topic.links.map((l) => (
                  <li key={l} className="flex items-center gap-2 pl-3">
                    <a href={l} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 truncate py-2 text-accent underline underline-offset-2">
                      {l.replace(/^https?:\/\//, '')}
                      <span className="sr-only"> (opens in a new tab)</span>
                    </a>
                    <button
                      type="button"
                      aria-label={`Remove link ${l}`}
                      onClick={() => void update({ links: topic.links.filter((x) => x !== l) })}
                      className="grid size-10 shrink-0 place-items-center text-muted hover:text-text"
                    >
                      <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden="true">
                        <path d="M4 4l8 8M12 4l-8 8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                      </svg>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                addLink()
              }}
            >
              <label htmlFor={ids.link} className="sr-only">
                Add a link
              </label>
              <input
                id={ids.link}
                type="url"
                inputMode="url"
                placeholder="https://…"
                value={link}
                aria-invalid={linkError !== null}
                aria-describedby={linkError ? `${ids.link}-err` : undefined}
                onChange={(e) => setLink(e.target.value)}
                className={`${field} min-w-0 flex-1 placeholder:text-muted`}
              />
              <button type="submit" disabled={!link.trim()} className="min-h-10 rounded-lg border border-line bg-raised px-3 font-medium disabled:opacity-50">
                Add
              </button>
            </form>
            {linkError && (
              <p id={`${ids.link}-err`} className="text-xs text-red-300">
                {linkError}
              </p>
            )}
          </section>
        </div>
      </div>
    </dialog>
  )
}
