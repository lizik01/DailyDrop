import { Resend } from 'resend'

// Placeholder keeps `next build` working without secrets; real sends need RESEND_API_KEY.
export const resend = new Resend(process.env.RESEND_API_KEY ?? 're_missing_key')
export const EMAIL_FROM = process.env.EMAIL_FROM ?? 'DailyDrop <onboarding@resend.dev>'
