import { eq } from 'drizzle-orm'
import type { NextRequest } from 'next/server'
import { db, subscribers } from '@/lib/db'
import { appUrl, verify } from '@/lib/links'

async function unsubscribe(req: NextRequest, ctx: RouteContext<'/api/unsubscribe/[subscriberId]'>) {
  const { subscriberId } = await ctx.params
  if (!verify(`unsub:${subscriberId}`, req.nextUrl.searchParams.get('sig'))) {
    return new Response('Bad link', { status: 400 })
  }
  await db.update(subscribers).set({ status: 'unsubscribed' }).where(eq(subscribers.id, subscriberId))
  return Response.redirect(appUrl('/thanks?unsubscribed=1'), 303)
}

// GET for the footer link, POST for RFC 8058 one-click unsubscribe from Gmail / Apple Mail.
export { unsubscribe as GET, unsubscribe as POST }
