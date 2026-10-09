import { useEffect, useMemo, useRef, useState } from 'react'
import type { TopicActions } from '../components/TopicRow'
import { loadCatalog, setRevision, setTopicDone, type Catalog, type Topic } from './data'

export const message = (e: unknown) => (e instanceof Error ? e.message : String(e))

function patchTopics(cat: Catalog, match: (t: Topic) => boolean, patch: (t: Topic) => Partial<Topic>): Catalog {
  const topics = cat.topics.map((t) => (match(t) ? { ...t, ...patch(t) } : t))
  return { ...cat, topics, topicById: new Map(topics.map((t) => [t.id, t])) }
}

type Hooks = {
  onDoneChanged?: (topicId: string, doneAt: string | null) => void
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
      onError: (e) => setError(message(e)),
    }),
    [],
  )

  return { cat, setCat, error, setError, actions }
}
