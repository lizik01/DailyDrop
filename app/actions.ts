'use server'

import { eq } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { profileFromPrompt } from '@/lib/ai/profile'
import { db, subscribers } from '@/lib/db'
import { inngest, subscriberCreated } from '@/lib/inngest/client'
import { verify } from '@/lib/links'

const signupSchema = z.object({
  email: z.email(),
  name: z.string().trim().max(60).optional(),
  interests: z.string().trim().min(10, 'Tell us a little more — a sentence or two is perfect.').max(1000),
  timezone: z.string().min(1),
  sendHour: z.coerce.number().int().min(0).max(23),
})

export type SignupState = { error?: string } | undefined

export async function subscribe(_: SignupState, formData: FormData): Promise<SignupState> {
  const parsed = signupSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const { email, name, interests, timezone, sendHour } = parsed.data

  const [existing] = await db.select({ id: subscribers.id }).from(subscribers).where(eq(subscribers.email, email))
  if (existing) return { error: 'That email is already subscribed. Use the “Tune your interests” link in any digest.' }

  const profile = await profileFromPrompt(interests)

  const [sub] = await db
    .insert(subscribers)
    .values({ email, name: name || null, interestPrompt: interests, profile, timezone, sendHour })
    .returning({ id: subscribers.id })

  await inngest.send(subscriberCreated.create({ subscriberId: sub.id }))
  redirect('/thanks?welcome=1')
}

const updateSchema = z.object({
  subscriberId: z.string().uuid(),
  sig: z.string(),
  interests: z.string().trim().min(10).max(1000),
  sendHour: z.coerce.number().int().min(0).max(23),
  paused: z.literal('on').optional(),
})

/** Changing the interest text re-runs profile extraction; changing only the send hour doesn't. */
export async function updateInterests(formData: FormData) {
  const { subscriberId, sig, interests, sendHour, paused } = updateSchema.parse(Object.fromEntries(formData))
  if (!verify(`me:${subscriberId}`, sig)) throw new Error('Unauthorized')

  const [current] = await db.select().from(subscribers).where(eq(subscribers.id, subscriberId))
  const changed = current.interestPrompt !== interests

  await db
    .update(subscribers)
    .set({
      interestPrompt: interests,
      sendHour,
      status: paused ? 'paused' : current.status === 'paused' ? 'active' : current.status,
      ...(changed && { profile: await profileFromPrompt(interests) }),
    })
    .where(eq(subscribers.id, subscriberId))

  redirect(`/me/${subscriberId}?sig=${sig}&saved=1`)
}
