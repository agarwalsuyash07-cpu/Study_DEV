import { createElement, useEffect, useMemo, useRef, useState } from 'react'
import TopicDrawer from '../components/TopicDrawer'
import type { TopicActions } from '../components/TopicRow'
import { loadCatalog, saveReview, setConfidence, setRevision, setTopicDoneAt, updateTopic, type Catalog, type Topic } from './data'
import { todayIST } from './date'
import { afterAgain, afterDone, CONFIDENCE_NAMES, firstReview, type Confidence, type ReviewState } from './revision'
import { doneDay } from './stats'
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
  const [openId, setOpenId] = useState<string | null>(null)
  const hooksRef = useRef(hooks)
  // actions are created once; they read the latest catalog through this ref
  const catRef = useRef(cat)
  useEffect(() => {
    hooksRef.current = hooks
    catRef.current = cat
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
    const patchReview = (topicId: string, state: ReviewState) =>
      setCat((c) => (c ? { ...c, revisions: new Map(c.revisions).set(topicId, state) } : c))

    async function apply(topic: Topic, doneAt: string | null) {
      await setTopicDoneAt(topic.id, doneAt)
      // completing schedules the first review; un-ticking clears the schedule
      const day = doneDay(doneAt)
      const review = day ? firstReview(day, topic.confidence) : { dueDate: null, step: 0 }
      await saveReview(topic.id, review)
      setCat((c) => (c ? patchTopics(c, (t) => t.id === topic.id, () => ({ done: doneAt !== null, doneAt })) : c))
      patchReview(topic.id, review)
      hooksRef.current.onDoneChanged?.(topic.id, doneAt)
    }

    async function setConfidenceFor(topic: Topic, confidence: Confidence | null) {
      await setConfidence(topic.id, confidence)
      setCat((c) => (c ? patchTopics(c, (t) => t.id === topic.id, () => ({ confidence })) : c))
    }

    // every tick/untick, from any page, gets the same 5s Undo that restores the exact previous timestamp
    async function setDoneAt(topic: Topic, doneAt: string | null) {
      const prev = topic.doneAt
      await apply(topic, doneAt)
      const day = doneDay(doneAt)
      const rate = ([1, 2, 3] as const).map((c) => ({
        label: String(c),
        ariaLabel: `Confidence ${c} of 3 (${CONFIDENCE_NAMES[c]}) for "${topic.title}"`,
        // one tap; low confidence pulls the first review closer
        run: async () => {
          await setConfidenceFor(topic, c)
          if (!day) return
          const review = firstReview(day, c)
          await saveReview(topic.id, review)
          patchReview(topic.id, review)
        },
      }))
      showToast({
        message: `${doneAt ? 'Done' : 'Not done'}: ${topic.title}`,
        actions: [...(doneAt ? rate : []), { label: 'Undo', ariaLabel: `Undo for "${topic.title}"`, run: () => apply(topic, prev) }],
      })
    }

    return {
      onToggleDone: (topic, done) => setDoneAt(topic, done ? new Date().toISOString() : null),
      onSetDoneAt: setDoneAt,
      onSetConfidence: setConfidenceFor,
      onReview: async (topic, outcome) => {
        const cur = catRef.current?.revisions.get(topic.id) ?? { dueDate: null, step: 0 }
        const today = todayIST()
        const next = outcome === 'done' ? afterDone(today, cur.step, topic.confidence) : afterAgain(today, topic.confidence)
        const reviewedAt = new Date().toISOString()
        await saveReview(topic.id, next, reviewedAt)
        setCat((c) => (c ? patchTopics(c, (t) => t.id === topic.id, () => ({ lastReviewedAt: reviewedAt })) : c))
        patchReview(topic.id, next)
      },
      onToggleStar: async (topic) => {
        await setRevision(topic.id, !topic.revision)
        setCat((c) => (c ? patchTopics(c, (t) => t.id === topic.id, () => ({ revision: !topic.revision })) : c))
      },
      onError: (e) => setError(message(e)),
      onOpen: (topic) => setOpenId(topic.id),
      onUpdate: async (topic, patch) => {
        await updateTopic(topic.id, patch)
        setCat((c) =>
          c
            ? patchTopics(
                c,
                (t) => t.id === topic.id,
                (t) => {
                  const next = { ...t, ...patch }
                  return { ...patch, estMinutes: next.estOverride ?? next.estDerived }
                },
              )
            : c,
        )
      },
    }
  }, [])

  const open = openId && cat ? cat.topicById.get(openId) : undefined
  const drawer = open
    ? // oxlint-disable-next-line react/refs -- reason: actions read refs only inside event callbacks, never during render
      createElement(TopicDrawer, {
        key: open.id,
        topic: open,
        track: cat?.tracks.find((t) => t.id === open.trackId),
        review: cat?.revisions.get(open.id) ?? null,
        actions,
        onClose: () => setOpenId(null),
      })
    : null

  return { cat, setCat, error, setError, actions, drawer }
}
