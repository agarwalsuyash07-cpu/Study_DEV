import { useCallback, useEffect, useState } from 'react'

export type ActiveTimer = { topicId: string; startedAt: string }
const KEY = 'activeTimer'

function read(): ActiveTimer | null {
  let raw: string | null
  try {
    raw = localStorage.getItem(KEY)
  } catch (e) {
    console.warn('timer: localStorage unavailable', e)
    return null
  }
  if (!raw) return null
  try {
    const v: unknown = JSON.parse(raw)
    if (
      v && typeof v === 'object' &&
      'topicId' in v && typeof v.topicId === 'string' &&
      'startedAt' in v && typeof v.startedAt === 'string' &&
      !Number.isNaN(Date.parse(v.startedAt))
    ) return { topicId: v.topicId, startedAt: v.startedAt }
  } catch (e) {
    console.warn('timer: discarding unreadable saved timer', e)
  }
  localStorage.removeItem(KEY)
  return null
}

function write(v: ActiveTimer | null) {
  try {
    if (v) localStorage.setItem(KEY, JSON.stringify(v))
    else localStorage.removeItem(KEY)
  } catch (e) {
    console.warn('timer: could not persist; it will not survive a refresh', e)
  }
}

/** One active timer, persisted so a refresh keeps it. `save` runs on stop; the timer is only cleared if it succeeds. */
export function useTimer(save: (t: ActiveTimer, endedAt: Date, minutes: number) => Promise<void>) {
  const [active, setActive] = useState<ActiveTimer | null>(read)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!active) return
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [active])

  const stop = useCallback(async () => {
    if (!active) return
    const end = new Date()
    const minutes = Math.round((end.getTime() - Date.parse(active.startedAt)) / 60_000)
    // under a minute is discarded rather than logged as 0
    if (minutes >= 1) await save(active, end, minutes)
    write(null)
    setActive(null)
  }, [active, save])

  const start = useCallback(
    async (topicId: string) => {
      await stop()
      const next = { topicId, startedAt: new Date().toISOString() }
      write(next)
      setActive(next)
    },
    [stop],
  )

  const elapsedSec = active ? Math.max(0, Math.floor((now - Date.parse(active.startedAt)) / 1000)) : 0
  return { active, elapsedSec, start, stop }
}
