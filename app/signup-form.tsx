'use client'

import { useActionState, useEffect, useState } from 'react'
import { subscribe } from './actions'

const EXAMPLES = [
  'Backend engineer. Rust, Postgres internals, and how people actually run LLMs in production. No crypto, no gadget reviews.',
  'PM at a fintech startup — I want the big AI moves, regulation, and anything about payments infra. Keep it short.',
  'CS student into security and reverse engineering. Love deep technical write-ups.',
]

export function SignupForm() {
  const [state, action, pending] = useActionState(subscribe, undefined)
  const [timezone, setTimezone] = useState('America/New_York')
  const [interests, setInterests] = useState('')

  useEffect(() => setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone), [])

  return (
    <form action={action} className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <div>
        <label htmlFor="interests" className="block text-sm font-medium">What do you want to read about?</label>
        <p className="mt-1 text-sm text-zinc-500">Write it like you’d tell a friend. The AI editor turns this into your reading profile.</p>
        <textarea
          id="interests"
          name="interests"
          required
          rows={4}
          value={interests}
          onChange={(e) => setInterests(e.target.value)}
          className="mt-2 w-full rounded-lg border border-zinc-300 p-3 text-sm focus:border-brand focus:outline-none"
          placeholder={EXAMPLES[0]}
        />
        <div className="mt-2 flex flex-wrap gap-2">
          {EXAMPLES.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => setInterests(example)}
              className="rounded-full bg-zinc-100 px-3 py-1 text-xs text-zinc-600 hover:bg-zinc-200"
            >
              {example.slice(0, 36)}…
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-[1fr_1fr_auto]">
        <input name="email" type="email" required placeholder="you@example.com" className="rounded-lg border border-zinc-300 p-3 text-sm" />
        <input name="name" placeholder="First name (optional)" className="rounded-lg border border-zinc-300 p-3 text-sm" />
        <select name="sendHour" defaultValue="7" className="rounded-lg border border-zinc-300 p-3 text-sm" aria-label="Send time">
          {[6, 7, 8, 9, 12, 17, 20].map((h) => (
            <option key={h} value={h}>{new Date(2000, 0, 1, h).toLocaleTimeString('en-US', { hour: 'numeric' })}</option>
          ))}
        </select>
      </div>
      <input type="hidden" name="timezone" value={timezone} />

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button
        disabled={pending}
        className="w-full rounded-lg bg-brand py-3 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
      >
        {pending ? 'Building your reader profile…' : 'Start my daily drop'}
      </button>
      <p className="text-center text-xs text-zinc-400">Delivered {timezone.replace('_', ' ')} time. Unsubscribe in one click.</p>
    </form>
  )
}
