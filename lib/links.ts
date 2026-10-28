import { createHmac, timingSafeEqual } from 'node:crypto'

// Links in emails are HMAC-signed, so subscribers need no password
// and nobody can open someone else's settings by guessing an id.

const secret = () => process.env.LINK_SECRET ?? 'dev-secret'
export const appUrl = (path: string) => new URL(path, process.env.APP_URL ?? 'http://localhost:3000').toString()

export function sign(value: string) {
  return createHmac('sha256', secret()).update(value).digest('base64url').slice(0, 22)
}

export function verify(value: string, signature: string | null | undefined) {
  if (!signature) return false
  const expected = Buffer.from(sign(value))
  const given = Buffer.from(signature)
  return expected.length === given.length && timingSafeEqual(expected, given)
}

export const manageUrl = (subscriberId: string) => appUrl(`/me/${subscriberId}?sig=${sign(`me:${subscriberId}`)}`)
export const unsubscribeUrl = (subscriberId: string) =>
  appUrl(`/api/unsubscribe/${subscriberId}?sig=${sign(`unsub:${subscriberId}`)}`)
