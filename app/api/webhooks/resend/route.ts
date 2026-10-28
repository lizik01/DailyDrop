import { eq, sql } from 'drizzle-orm'
import type { NextRequest } from 'next/server'
import { db, digests, emailEvents, subscribers } from '@/lib/db'
import { resend } from '@/lib/email'

type DigestStatus = (typeof digests.$inferSelect)['status']

// Later states win: a digest that was opened stays "opened" even if "delivered" arrives late.
const STATUS_RANK: Record<DigestStatus, number> = {
  generated: 0,
  failed: 1,
  sent: 2,
  delivered: 3,
  opened: 4,
  bounced: 5,
  complained: 6,
}

const STATUS_FOR_EVENT: Partial<Record<string, DigestStatus>> = {
  'email.delivered': 'delivered',
  'email.opened': 'opened',
  'email.clicked': 'opened', // a click implies an open, even with images blocked
  'email.bounced': 'bounced',
  'email.complained': 'complained',
  'email.failed': 'failed',
}

export async function POST(req: NextRequest) {
  const payload = await req.text()
  let event
  try {
    event = resend.webhooks.verify({
      payload,
      headers: {
        id: req.headers.get('svix-id') ?? '',
        timestamp: req.headers.get('svix-timestamp') ?? '',
        signature: req.headers.get('svix-signature') ?? '',
      },
      webhookSecret: process.env.RESEND_WEBHOOK_SECRET!,
    })
  } catch {
    return new Response('Invalid signature', { status: 401 })
  }
  if (!event.type.startsWith('email.') || !('email_id' in event.data)) return Response.json({ ignored: true })

  const data = event.data
  const webhookId = req.headers.get('svix-id')!
  const digestId = ('tags' in data && data.tags?.digest_id) || null
  const occurredAt = new Date(event.created_at)

  const [stored] = await db
    .insert(emailEvents)
    .values({ webhookId, resendEmailId: data.email_id, digestId, type: event.type, payload: event, occurredAt })
    .onConflictDoNothing({ target: emailEvents.webhookId })
    .returning({ id: emailEvents.id })
  if (!stored) return Response.json({ duplicate: true })

  const next = STATUS_FOR_EVENT[event.type]
  if (next) {
    const where = digestId ? eq(digests.id, digestId) : eq(digests.resendEmailId, data.email_id)
    const [digest] = await db.select({ id: digests.id, status: digests.status, subscriberId: digests.subscriberId }).from(digests).where(where)
    if (digest) {
      await db
        .update(digests)
        .set({
          status: STATUS_RANK[next] > STATUS_RANK[digest.status] ? next : digest.status,
          ...(next === 'opened' && { openedAt: sql`coalesce(${digests.openedAt}, ${occurredAt})` }),
        })
        .where(eq(digests.id, digest.id))

      // Hard bounces and spam complaints stop future sends — protects sender reputation.
      const isHardBounce = event.type === 'email.bounced' && event.data.bounce.type.toLowerCase() === 'permanent'
      if (isHardBounce || event.type === 'email.complained') {
        await db
          .update(subscribers)
          .set({ status: isHardBounce ? 'bounced' : 'unsubscribed' })
          .where(eq(subscribers.id, digest.subscriberId))
      }
    }
  }

  return Response.json({ ok: true })
}
