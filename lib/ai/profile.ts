import { z } from 'zod'
import type { InterestProfile } from '@/lib/db/schema'
import { generateStructured } from './harness'

export const interestProfileSchema = z.object({
  summary: z.string().describe('One sentence, second person: who this reader is and what they want from tech news.'),
  topics: z
    // The length cap rejects merged junk like "Postgres (pg) databases','pgvector" and triggers a retry.
    .array(z.string().min(2).max(30))
    .min(3)
    .max(10)
    .describe('1–3 word search keywords, most important first. "Rust", "LLM inference", "Postgres". Not "programming".'),
  avoid: z.array(z.string()).describe('Topics they do not want.'),
  tone: z.enum(['crisp', 'friendly', 'analytical']),
}) satisfies z.ZodType<InterestProfile>

/** "I'm a backend dev into Rust and LLM infra, skip crypto" → structured profile. */
export async function profileFromPrompt(prompt: string): Promise<InterestProfile> {
  const result = await generateStructured({
    purpose: 'profile',
    schema: interestProfileSchema,
    instructions:
      'You build reader profiles for DailyDrop, a personalized daily tech-news email. ' +
      'Turn what the reader says into short keyword topics that would match news headlines. ' +
      'Infer tone from how they write.',
    prompt,
  })
  return result.ok ? result.value : fallbackProfile(prompt)
}

/** If the LLM is down at signup, still subscribe them: use the words they typed as topics. */
function fallbackProfile(prompt: string): InterestProfile {
  const phrases = prompt
    // Split on commas and sentence ends, but not the dot in "Next.js".
    .split(/[,;\n]|\.(?=\s|$)|\band\b/i)
    .map((t) => t.trim().replace(/^i(?:'m| am)?\s+(?:follow|like|love|want|into)\s+/i, ''))
    .filter((t) => t.length > 1 && t.length < 40)
  // "no crypto", "skip gadget reviews", "not into NFTs" → avoid list
  const negation = /^(no|not|skip|avoid|without|nothing about|not into)\s+/i
  const avoid = phrases.filter((p) => negation.test(p)).map((p) => p.replace(negation, ''))
  const topics = phrases.filter((p) => !negation.test(p)).slice(0, 8)
  return { summary: prompt.slice(0, 200), topics: topics.length ? topics : ['technology'], avoid, tone: 'crisp' }
}
