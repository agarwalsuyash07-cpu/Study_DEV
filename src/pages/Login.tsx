import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle')
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setState('sending')
    setError(null)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    })
    if (error) {
      setError(error.message)
      setState('idle')
    } else setState('sent')
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-4">
      <h1 className="text-xl font-medium">Study Tracker</h1>
      {state === 'sent' ? (
        <p className="text-muted">Check {email} for the sign-in link.</p>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-3">
          <label htmlFor="email" className="text-sm text-muted">Email</label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-[10px] border border-line bg-raised px-3 py-2.5 outline-none focus:border-accent"
          />
          <button
            disabled={state === 'sending'}
            className="rounded-[10px] bg-accent py-2.5 font-medium text-white disabled:opacity-50"
          >
            {state === 'sending' ? 'Sending…' : 'Send magic link'}
          </button>
          {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
        </form>
      )}
    </main>
  )
}
