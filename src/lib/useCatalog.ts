import { useEffect, useMemo, useRef, useState } from 'react'
import type { TopicActions } from '../components/TopicRow'
import { loadCatalog, setRevision, setTopicDoneAt, type Catalog, type Topic } from './data'
import { showToast } from './toast'

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

  const actions: TopicActions = useMemo(() => {
    async function apply(topic: Topic, doneAt: string | null) {
      await setTopicDoneAt(topic.id, doneAt)
      setCat((c) => (c ? patchTopics(c, (t) => t.id === topic.id, () => ({ done: doneAt !== null, doneAt })) : c))
      hooksRef.current.onDoneChanged?.(topic.id, doneAt)
    }
    // every tick/untick, from any page, gets the same 5s Undo that restores the exact previous timestamp
    async function setDoneAt(topic: Topic, doneAt: string | null) {
      const prev = topic.doneAt
      await apply(topic, doneAt)
      showToast({
        message: `${doneAt ? 'Done' : 'Not done'}: ${topic.title}`,
        actions: [{ label: 'Undo', ariaLabel: `Undo for "${topic.title}"`, run: () => apply(topic, prev) }],
      })
    }
    return {
      onToggleDone: (topic, done) => setDoneAt(topic, done ? new Date().toISOString() : null),
      onSetDoneAt: setDoneAt,
      onToggleStar: async (topic) => {
        await setRevision(topic.id, !topic.revision)
        setCat((c) => (c ? patchTopics(c, (t) => t.id === topic.id, () => ({ revision: !topic.revision })) : c))
      },
      onError: (e) => setError(message(e)),
    }
  }, [])

  return { cat, setCat, error, setError, actions }
}
