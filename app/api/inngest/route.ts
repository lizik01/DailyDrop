import { serve } from 'inngest/next'
import { inngest } from '@/lib/inngest/client'
import { functions } from '@/lib/inngest/functions'

// The editor agent can take a while on a long candidate list.
export const maxDuration = 300

export const { GET, POST, PUT } = serve({ client: inngest, functions })
