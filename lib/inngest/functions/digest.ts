import { and, asc, eq } from 'drizzle-orm'
import DailyDigest from '@/emails/DailyDigest'
import Welcome from '@/emails/Welcome'
import { writeDigest } from '@/lib/ai/editor'
import { articles, db, digestItems, digests, subscribers } from '@/lib/db'
import { EMAIL_FROM, resend } from '@/lib/email'
import { manageUrl, unsubscribeUrl } from '@/lib/links'
import { findCandidates } from '@/lib/retrieval'
import { localClock } from '@/lib/time'
import { digestRequested, inngest, subscriberCreated } from '../client'

/**
 * Runs at :05 every hour. Timezone-aware delivery = check each subscriber's local hour,
 * then fan out one event per subscriber who is due. Each one runs and retries on its own.
 */
export const scheduleDigests = inngest.createFunction(
  { id: 'schedule-digests', triggers: [{ cron: '5 * * * *' }] },
  async ({ step }) => {
    const due = await step.run('find-due-subscribers', async () => {
      const active = await db
        .select({ id: subscribers.id, timezone: subscribers.timezone, sendHour: subscribers.sendHour })
        .from(subscribers)
        .where(eq(subscribers.status, 'active'))
      return active.flatMap((s) => {
        const clock = localClock(s.timezone)
        return clock.hour === s.sendHour ? [{ subscriberId: s.id, day: clock.day }] : []
      })
    })
    if (due.length) await step.sendEvent('fan-out', due.map((d) => digestRequested.create(d)))
    return { scheduled: due.length }
  },
)

/** One subscriber, one day: write the digest (step 1), then send it (step 2). */
export const buildDigest = inngest.createFunction(
  {
    id: 'build-digest',
    triggers: [digestRequested],
    // A duplicate event for the same subscriber + day is dropped.
    idempotency: 'event.data.subscriberId + "-" + event.data.day',
    concurrency: { limit: 10 },
    retries: 3,
  },
  async ({ event, step }) => {
    const { subscriberId, day } = event.data

    // Step 1 saves the AI output to Postgres and returns only the id. If step 2 fails,
    // Inngest retries step 2 alone and reuses this result. The LLM never runs twice.
    const digestId = await step.run('write-digest', async () => {
      const [existing] = await db
        .select({ id: digests.id })
        .from(digests)
        .where(and(eq(digests.subscriberId, subscriberId), eq(digests.day, day)))
      if (existing) return existing.id

      const [sub] = await db.select().from(subscribers).where(eq(subscribers.id, subscriberId))
      if (!sub || sub.status !== 'active') return null

      const shortlist = await findCandidates({ subscriberId, topics: sub.profile.topics, avoid: sub.profile.avoid, limit: 15 })
      const draft = await writeDigest({ subscriberId, profile: sub.profile, shortlist })
      if (!draft) return null

      return db.transaction(async (tx) => {
        const [digest] = await tx
          .insert(digests)
          .values({ subscriberId, day, content: draft.content, source: draft.source })
          .returning({ id: digests.id })
        await tx.insert(digestItems).values(
          draft.items.map((item, position) => ({
            digestId: digest.id,
            articleId: item.article.id,
            position,
            headline: item.headline,
            blurb: item.blurb,
            whyYou: item.whyYou,
          })),
        )
        return digest.id
      })
    })

    if (!digestId) return { skipped: 'inactive subscriber or not enough news' }
    const emailId = await step.run('send-email', () => sendDigest(digestId))
    return { digestId, emailId }
  },
)

/** Welcome email, then the first digest right away instead of waiting for tomorrow. */
export const onboardSubscriber = inngest.createFunction(
  { id: 'onboard-subscriber', triggers: [subscriberCreated] },
  async ({ event, step }) => {
    const sub = await step.run('send-welcome', async () => {
      const [sub] = await db.select().from(subscribers).where(eq(subscribers.id, event.data.subscriberId))
      if (!sub) return null
      const { error } = await resend.emails.send(
        {
          from: EMAIL_FROM,
          to: sub.email,
          subject: 'Welcome to DailyDrop',
          react: Welcome({
            summary: sub.profile.summary,
            topics: sub.profile.topics,
            sendHour: sub.sendHour,
            manageUrl: manageUrl(sub.id),
          }),
        },
        { idempotencyKey: `welcome-${sub.id}` },
      )
      // Resend returns errors instead of throwing; throw so Inngest retries and the failure is visible.
      if (error) throw new Error(`Resend welcome failed: ${error.message}`)
      return { id: sub.id, timezone: sub.timezone }
    })
    if (!sub) return
    await step.sendEvent('first-digest', digestRequested.create({ subscriberId: sub.id, day: localClock(sub.timezone).day }))
  },
)

async function sendDigest(digestId: string) {
  const [digest] = await db.select().from(digests).where(eq(digests.id, digestId))
  // The subscriber was deleted between steps (cascade removed the digest): nothing to send.
  if (!digest) return null
  // Already sent on an earlier attempt that crashed after Resend accepted it.
  if (digest.resendEmailId) return digest.resendEmailId

  const [sub] = await db.select().from(subscribers).where(eq(subscribers.id, digest.subscriberId))
  const items = await db
    .select({
      headline: digestItems.headline,
      blurb: digestItems.blurb,
      whyYou: digestItems.whyYou,
      source: articles.source,
      url: articles.url,
    })
    .from(digestItems)
    .innerJoin(articles, eq(articles.id, digestItems.articleId))
    .where(eq(digestItems.digestId, digestId))
    .orderBy(asc(digestItems.position))

  const dateLabel = new Date(`${digest.day}T12:00:00`).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  })

  const { data, error } = await resend.emails.send(
    {
      from: EMAIL_FROM,
      to: sub.email,
      subject: digest.content.subject,
      react: DailyDigest({
        ...digest.content,
        name: sub.name,
        dateLabel,
        items,
        manageUrl: manageUrl(sub.id),
        unsubscribeUrl: unsubscribeUrl(sub.id),
      }),
      headers: {
        'List-Unsubscribe': `<${unsubscribeUrl(sub.id)}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
      // Lets the webhook map events back to this digest.
      tags: [{ name: 'digest_id', value: digestId }],
    },
    // Resend drops a second send with the same key, so a retry can't double-send.
    { idempotencyKey: `digest-${digestId}` },
  )
  if (error || !data) throw new Error(`Resend send failed: ${error?.message ?? 'no data'}`)

  await db
    .update(digests)
    .set({ resendEmailId: data.id, status: 'sent', sentAt: new Date() })
    .where(eq(digests.id, digestId))
  return data.id
}
