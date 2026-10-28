import { SignupForm } from './signup-form'

const STEPS = [
  { title: 'Say it in your words', body: 'An LLM turns your description into a structured profile: topics to follow, topics to skip, and a tone.' },
  { title: 'An AI editor picks', body: 'Each morning, full-text search builds your shortlist. An editor agent picks the stories, can run one search to fill a gap, and says why each one matters to you.' },
  { title: 'Delivered on your clock', body: 'Your digest arrives at the hour you chose in your own timezone. Unsubscribe with one click.' },
]

export default function Home() {
  return (
    <div className="space-y-12 pt-6">
      <section className="space-y-4">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Tech news, edited for an audience of <span className="text-brand">one</span>.
        </h1>
        <p className="max-w-xl text-lg text-zinc-600">
          Tell DailyDrop what you care about in plain words. An AI editor writes you a short digest every morning.
        </p>
      </section>

      <SignupForm />

      <section className="grid gap-4 sm:grid-cols-3">
        {STEPS.map((s, i) => (
          <div key={s.title} className="rounded-xl border border-zinc-200 bg-white p-5">
            <p className="text-xs font-semibold text-brand">0{i + 1}</p>
            <h2 className="mt-1 font-semibold">{s.title}</h2>
            <p className="mt-2 text-sm text-zinc-600">{s.body}</p>
          </div>
        ))}
      </section>
    </div>
  )
}
