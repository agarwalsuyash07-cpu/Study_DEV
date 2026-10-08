import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { TopicActions } from '../components/TopicRow'
import {
  addManualMinutes,
  loadCatalog,
  setModuleEst,
  setRevision,
  setTopicDone,
  type Catalog,
  type Topic,
} from './data'
import { topicEst } from './plan'

export const message = (e: unknown) => (e instanceof Error ? e.message : String(e))

function patchTopics(cat: Catalog, match: (t: Topic) => boolean, patch: (t: Topic) => Partial<Topic>): Catalog {
  const topics = cat.topics.map((t) => (match(t) ? { ...t, ...patch(t) } : t))
  return { ...cat, topics, topicById: new Map(topics.map((t) => [t.id, t])) }
}

type Hooks = {
  onDoneChanged?: (topicId: string, doneAt: string | null) => void
  onMinutesLogged?: (topicId: string, minutes: number) => void
}

/** Catalog state plus the topic actions every page shares. `autoLoad: false` lets a page load it itself. */
export function useCatalog({ autoLoad = true, ...hooks }: Hooks & { autoLoad?: boolean } = {}) {
  const [cat, setCat] = useState<Catalog | null>(null)
  const [error, setError] = useState<string | null>(null)
  const hooksRef = useRef(hooks)
  useEffect(() => {
    hooksRef.current = hooks
  })

  useEffect(() => {
    if (!autoLoad) return
    let cancelled = false
    loadCatalog().then(
      (c) => {
        if (!cancelled) setCat(c)
      },
      (e: unknown) => {
        if (!cancelled) setError(message(e))
      },
    )
    return () => {
      cancelled = true
    }
  }, [autoLoad])

  const logMinutes = useCallback((topicId: string, minutes: number) => {
    setCat((c) => (c ? patchTopics(c, (t) => t.id === topicId, (t) => ({ spentMin: t.spentMin + minutes })) : c))
    hooksRef.current.onMinutesLogged?.(topicId, minutes)
  }, [])

  const actions: TopicActions = useMemo(
    () => ({
      onToggleDone: async (topic, done) => {
        const doneAt = await setTopicDone(topic.id, done)
        setCat((c) => (c ? patchTopics(c, (t) => t.id === topic.id, () => ({ done, doneAt })) : c))
        hooksRef.current.onDoneChanged?.(topic.id, doneAt)
      },
      onToggleStar: async (topic) => {
        await setRevision(topic.id, !topic.revision)
        setCat((c) => (c ? patchTopics(c, (t) => t.id === topic.id, () => ({ revision: !topic.revision })) : c))
      },
      onAddMinutes: async (topic, minutes) => {
        await addManualMinutes(topic.id, minutes)
        logMinutes(topic.id, minutes)
      },
      onError: (e) => setError(message(e)),
    }),
    [logMinutes],
  )

  const updateModuleEst = useCallback(async (moduleId: string, estMinutes: number | null) => {
    await setModuleEst(moduleId, estMinutes)
    setCat((c) => {
      if (!c) return c
      const count = c.topics.filter((t) => t.moduleId === moduleId).length
      const est = topicEst(estMinutes, count)
      const next = patchTopics(c, (t) => t.moduleId === moduleId, () => ({ est }))
      return { ...next, modules: next.modules.map((m) => (m.id === moduleId ? { ...m, est_minutes: estMinutes } : m)) }
    })
  }, [])

  return { cat, setCat, error, setError, actions, logMinutes, updateModuleEst }
}
