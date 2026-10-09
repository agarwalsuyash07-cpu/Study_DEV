// Dumps every public table to backups/<timestamp>.json. Local only: needs the service-role key. Run before any migration.
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'

const env = z
  .object({
    SUPABASE_URL: z.url(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  })
  .parse(process.env)

const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const TABLES = ['tracks', 'modules', 'topics', 'sessions', 'schedule_blocks', 'day_plans', 'day_plan_items', 'user_settings', 'revisions', 'weekly_reviews']
const PAGE = 1000

const out: Record<string, unknown[]> = {}
for (const table of TABLES) {
  const all: unknown[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db.from(table).select('*').range(from, from + PAGE - 1)
    // tables that don't exist yet are skipped, not fatal
    if (error?.code === '42P01' || error?.code === 'PGRST205') break
    if (error) throw new Error(`backup ${table}: ${error.message}`)
    all.push(...data)
    if (data.length < PAGE) break
  }
  out[table] = all
  console.log(`${table}: ${all.length}`)
}

mkdirSync('backups', { recursive: true })
const file = join('backups', `${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
writeFileSync(file, JSON.stringify(out, null, 2))
console.log(`wrote ${file}`)
