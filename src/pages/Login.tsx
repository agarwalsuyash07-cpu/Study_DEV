import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'

const input = 'rounded-[10px] border border-line bg-raised px-3 py-2.5 focus-visible:border-accent'

// No sign-up form: single-user app; the password is set with `npm run set-password`.
export default function Login() {
  useEffect(() => {
    document.title = 'Sign in · Study Tracker'
  }, [])
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    // success needs no handling: main.tsx's onAuthStateChange swaps in the app
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    setBusy(false)
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-4">
      <h1 className="text-xl font-medium">Study Tracker</h1>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <label htmlFor="email" className="text-sm text-muted">Email</label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={input}
        />
        <label htmlFor="password" className="text-sm text-muted">Password</label>
        <input
          id="password"
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={input}
        />
        <button disabled={busy} className="mt-1 rounded-[10px] bg-accent py-2.5 font-medium text-white disabled:opacity-50">
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
      </form>
    </main>
  )
}
