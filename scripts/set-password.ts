// Sets the password for IMPORT_USER_EMAIL (creating the user if missing). Local only: needs the service-role key.
import { createInterface } from 'node:readline/promises'
import { Writable } from 'node:stream'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'

const env = z
  .object({
    SUPABASE_URL: z.url(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
    IMPORT_USER_EMAIL: z.email(),
  })
  .parse(process.env)

/** Prompt without echoing what's typed. */
async function askHidden(prompt: string): Promise<string> {
  let muted = false
  const output = new Writable({
    write(chunk, _enc, cb) {
      if (!muted) process.stdout.write(chunk)
      cb()
    },
  })
  const rl = createInterface({ input: process.stdin, output, terminal: true })
  const answer = rl.question(prompt)
  muted = true
  const value = await answer
  rl.close()
  process.stdout.write('\n')
  return value
}

const password = await askHidden(`New password for ${env.IMPORT_USER_EMAIL}: `)
if (password.length < 8) throw new Error('Password must be at least 8 characters')
if ((await askHidden('Repeat it: ')) !== password) throw new Error('Passwords did not match')

const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const { data, error } = await db.auth.admin.listUsers({ perPage: 1000 })
if (error) throw new Error(`listUsers: ${error.message}`)
const user = data.users.find((u) => u.email?.toLowerCase() === env.IMPORT_USER_EMAIL.toLowerCase())

// Updating (not recreating) keeps the user id, which every row's user_id points at.
const res = user
  ? await db.auth.admin.updateUserById(user.id, { password, email_confirm: true })
  : await db.auth.admin.createUser({ email: env.IMPORT_USER_EMAIL, password, email_confirm: true })
if (res.error) throw new Error(`set password: ${res.error.message}`)
console.log(user ? `Password updated for ${env.IMPORT_USER_EMAIL}.` : `Created ${env.IMPORT_USER_EMAIL} with that password.`)
