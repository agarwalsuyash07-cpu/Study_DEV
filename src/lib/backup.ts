import { z } from 'zod'
import { safeUrl } from './markdown'

// Shape of an Export-as-JSON file, validated before anything is written back. Unknown columns and user_id are stripped,
// so a file can only ever write the signed-in user's own rows (RLS enforces the same server-side).
const id = z.string().min(1).max(200)
const ts = z.iso.datetime({ offset: true })
const day = z.iso.date()
const origin = z.enum(['seed', 'app']).optional()

const schema = z.object({
  tracks: z
    .array(
      z.object({
        id,
        name: z.string().min(1).max(300),
        type: z.string().min(1).max(50),
        course_code: z.string().max(50).nullish(),
        sort_order: z.int(),
        exam_date: day.nullish(),
        count_in_overall: z.boolean().optional(),
        origin,
      }),
    )
    .default([]),
  modules: z
    .array(
      z.object({
        id,
        track_id: id,
        sort_order: z.int(),
        name: z.string().min(1).max(300),
        co: z.string().max(50).nullish(),
        est_minutes: z.int().positive().nullish(),
        origin,
      }),
    )
    .default([]),
  topics: z
    .array(
      z.object({
        id,
        module_id: id,
        sort_order: z.int(),
        title: z.string().min(1).max(500),
        bloom: z.string().max(30).nullish(),
        done_at: ts.nullish(),
        revision: z.boolean().optional(),
        confidence: z.int().min(1).max(3).nullish(),
        last_reviewed_at: ts.nullish(),
        est_minutes: z.int().min(1).max(600).nullish(),
        notes: z.string().max(20000).nullish(),
        links: z.array(z.string().refine(safeUrl, 'links must be http(s) URLs')).max(50).optional(),
        practice_done: z.boolean().optional(),
        origin,
      }),
    )
    .default([]),
  revisions: z.array(z.object({ topic_id: id, due_date: day.nullish(), interval_step: z.int().min(0) })).default([]),
  user_settings: z
    .array(
      z.object({
        streak_plan_pct: z.int().min(1).max(100),
        streak_min_no_plan: z.int().min(1).max(50),
        daily_budget: z.array(z.int().min(0).max(1440).nullable()).length(7).nullish(),
      }),
    )
    .max(1)
    .default([]),
  weekly_reviews: z.array(z.object({ week_start: day, reflection: z.string().max(10000), summary: z.json().optional() })).default([]),
  // existing rows only: updated by id, never inserted
  schedule_blocks: z
    .array(
      z.object({
        id: z.int(),
        weekday: z.int().min(0).max(6),
        track_id: id.nullish(),
        label: z.string().max(200).nullish(),
        topics: z.int().min(1).max(20).optional(),
        minutes: z.int().positive().optional(),
        sort_order: z.int(),
      }),
    )
    .default([]),
  day_plan_items: z.array(z.object({ id: z.int(), done_at: ts.nullish(), sort_order: z.int().optional(), track_id: id.nullish() })).default([]),
})

export type Backup = z.infer<typeof schema>
export type BackupCounts = Record<keyof Backup, number>

export function parseBackup(input: unknown): { ok: true; data: Backup; counts: BackupCounts } | { ok: false; error: string } {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return { ok: false, error: 'Not a Study Tracker export (expected a JSON object).' }
  }
  const res = schema.safeParse(input)
  if (!res.success) {
    const first = res.error.issues[0]!
    return { ok: false, error: `${first.path.join('.')}: ${first.message}` }
  }
  const d = res.data
  const counts: BackupCounts = {
    tracks: d.tracks.length,
    modules: d.modules.length,
    topics: d.topics.length,
    revisions: d.revisions.length,
    user_settings: d.user_settings.length,
    weekly_reviews: d.weekly_reviews.length,
    schedule_blocks: d.schedule_blocks.length,
    day_plan_items: d.day_plan_items.length,
  }
  return { ok: true, data: d, counts }
}
