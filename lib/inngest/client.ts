import { eventType, Inngest } from 'inngest'
import { z } from 'zod'

export const inngest = new Inngest({ id: 'dailydrop' })

export const subscriberCreated = eventType('subscriber/created', {
  schema: z.object({ subscriberId: z.string() }),
})

export const digestRequested = eventType('digest/requested', {
  schema: z.object({ subscriberId: z.string(), day: z.string() }),
})
