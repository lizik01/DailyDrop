// Models go through the Vercel AI Gateway (AI_GATEWAY_API_KEY), so switching
// providers is an env change, not a code change.
export const models = {
  smart: process.env.AI_MODEL ?? 'openai/gpt-5-mini',
}
