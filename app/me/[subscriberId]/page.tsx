import { desc, eq, sql } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { updateInterests } from '@/app/actions'
import { db, digests, subscribers } from '@/lib/db'
import { verify } from '@/lib/links'

export default async function ManagePage({ params, searchParams }: PageProps<'/me/[subscriberId]'>) {
  const { subscriberId } = await params
  const { sig, saved } = await searchParams
  if (typeof sig !== 'string' || !verify(`me:${subscriberId}`, sig)) notFound()

  const [sub] = await db.select().from(subscribers).where(eq(subscribers.id, subscriberId))
  if (!sub) notFound()

  const recent = await db
    .select({
      id: digests.id,
      day: digests.day,
      subject: sql<string>`${digests.content}->>'subject'`,
      status: digests.status,
      source: digests.source,
    })
    .from(digests)
    .where(eq(digests.subscriberId, subscriberId))
    .orderBy(desc(digests.day))
    .limit(7)

  return (
    <div className="space-y-8">
      {saved && <p className="rounded-lg bg-green-50 p-3 text-sm text-green-700">Saved. Your next digest uses the new settings.</p>}

      <section className="rounded-2xl border border-zinc-200 bg-white p-6">
        <h1 className="text-xl font-bold">Your reading profile</h1>
        <p className="mt-2 text-zinc-600 italic">“{sub.profile.summary}”</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {sub.profile.topics.map((t) => (
            <span key={t} className="rounded-full bg-indigo-50 px-3 py-1 text-sm text-brand">{t}</span>
          ))}
        </div>
        {sub.profile.avoid.length > 0 && (
          <p className="mt-4 text-sm text-zinc-500">Skipping: {sub.profile.avoid.join(', ')}</p>
        )}
      </section>

      {recent.length > 0 && (
        <section className="rounded-2xl border border-zinc-200 bg-white p-6">
          <h2 className="font-semibold">Recent drops</h2>
          <ul className="mt-3 divide-y divide-zinc-100 text-sm">
            {recent.map((d) => (
              <li key={d.id} className="flex justify-between gap-4 py-2">
                <span className="truncate">{d.subject}</span>
                <span className="shrink-0 text-zinc-400">
                  {d.day} · {d.status}{d.source === 'fallback' ? ' · template' : ''}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <form action={updateInterests} className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-6">
        <h2 className="font-semibold">Change your interests</h2>
        <input type="hidden" name="subscriberId" value={subscriberId} />
        <input type="hidden" name="sig" value={sig} />
        <textarea name="interests" defaultValue={sub.interestPrompt} rows={4} className="w-full rounded-lg border border-zinc-300 p-3 text-sm" />
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <label className="flex items-center gap-2">
            Send at
            <select name="sendHour" defaultValue={sub.sendHour} className="rounded-lg border border-zinc-300 p-2">
              {Array.from({ length: 24 }, (_, h) => (
                <option key={h} value={h}>{new Date(2000, 0, 1, h).toLocaleTimeString('en-US', { hour: 'numeric' })}</option>
              ))}
            </select>
            <span className="text-zinc-400">({sub.timezone})</span>
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="paused" defaultChecked={sub.status === 'paused'} /> Pause digests
          </label>
        </div>
        <button className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white">Save</button>
      </form>
    </div>
  )
}
