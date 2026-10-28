import { tool } from 'ai'
import { z } from 'zod'
import type { DigestContent, InterestProfile } from '@/lib/db/schema'
import { searchArticles, type Candidate } from '@/lib/retrieval'
import { generateStructured } from './harness'

export const ITEMS = { min: 3, max: 6 }
/** Model turns + tool calls. Enough for two searches and a final answer; stops runaway loops. */
const MAX_STEPS = 4

const digestSchema = z.object({
  subject: z.string().max(80).describe('Email subject that names the top story. No emoji, no clickbait.'),
  intro: z.string().describe('2–3 sentences in the reader’s tone tying today’s stories to their interests.'),
  items: z
    .array(
      z.object({
        ref: z.string().describe('The [ref] of a candidate, e.g. "a3".'),
        headline: z.string(),
        blurb: z.string().describe('Two sentences: what happened and why it matters.'),
        whyYou: z.string().describe('One short line on why THIS reader should care.'),
      }),
    )
    .min(ITEMS.min)
    .max(ITEMS.max),
})

export type DigestDraft = {
  source: 'llm' | 'fallback'
  content: DigestContent
  items: { article: Candidate; headline: string; blurb: string; whyYou: string }[]
}

const describe = (ref: string, c: Candidate) => `[${ref}] ${c.title} (${c.source})\n${c.snippet ?? ''}`

/**
 * Editor agent: picks and writes up today's stories from the shortlist. It has one tool,
 * searchArticles, for when an interest isn't covered. If the agent fails twice, the
 * template fallback still sends a digest built from the shortlist.
 */
export async function writeDigest(opts: {
  subscriberId: string
  profile: InterestProfile
  shortlist: Candidate[]
}): Promise<DigestDraft | null> {
  const { subscriberId, profile, shortlist } = opts
  if (shortlist.length < ITEMS.min) return null

  // Refs ("a1", "a2"…) instead of UUIDs: shorter for the model and easy to validate.
  const pool = new Map<string, Candidate>()
  const add = (c: Candidate) => {
    if ([...pool.values()].some((p) => p.id === c.id)) return null
    const ref = `a${pool.size + 1}`
    pool.set(ref, c)
    return ref
  }
  shortlist.forEach(add)

  const result = await generateStructured({
    purpose: 'editor',
    subscriberId,
    schema: digestSchema,
    maxSteps: MAX_STEPS,
    tools: {
      searchArticles: tool({
        description: 'Full-text search over the last 36h of tech news. Use only if a top interest has no candidate.',
        inputSchema: z.object({ query: z.string().describe('A few keywords, e.g. "WebGPU Safari".') }),
        execute: async ({ query }) => {
          const found = await searchArticles({ subscriberId, terms: [query], avoid: profile.avoid, limit: 5 })
          const fresh = found.flatMap((c) => {
            const ref = add(c)
            return ref ? [describe(ref, c)] : []
          })
          return fresh.length ? fresh.join('\n\n') : 'No new articles for that query.'
        },
      }),
    },
    instructions: [
      'You are the editor of DailyDrop, a tech newsletter written for one reader.',
      `Reader: ${profile.summary}`,
      `Interests: ${profile.topics.join(', ')}`,
      profile.avoid.length ? `Never include: ${profile.avoid.join(', ')}` : '',
      `Tone: ${profile.tone}.`,
      `Pick ${ITEMS.min}–${ITEMS.max} stories, most relevant first, covering several interests.`,
      'Only use refs from the candidates or your own search results. Do not invent facts beyond the excerpts.',
    ]
      .filter(Boolean)
      .join('\n'),
    prompt: `Candidates:\n\n${[...pool].map(([ref, c]) => describe(ref, c)).join('\n\n')}`,
    // Zod checks the shape; this checks the model only cited articles that exist, once each.
    validate: ({ items }) => {
      const unknown = items.filter((i) => !pool.has(i.ref)).map((i) => i.ref)
      if (unknown.length) return `Unknown refs: ${unknown.join(', ')}. Use only refs from the list.`
      if (new Set(items.map((i) => i.ref)).size !== items.length) return 'Each ref may appear only once.'
      return null
    },
  })

  if (!result.ok) return templateDigest(profile, shortlist)

  const { items, ...content } = result.value
  return {
    source: 'llm',
    content,
    items: items.map((i) => ({ article: pool.get(i.ref)!, headline: i.headline, blurb: i.blurb, whyYou: i.whyYou })),
  }
}

/** No LLM: top of the shortlist, original headlines and excerpts. Plain, but the email still goes out. */
function templateDigest(profile: InterestProfile, shortlist: Candidate[]): DigestDraft {
  const picks = shortlist.slice(0, ITEMS.max)
  return {
    source: 'fallback',
    content: {
      subject: `Your DailyDrop: ${picks[0].title}`.slice(0, 80),
      intro: `Today’s top stories for your interests: ${profile.topics.slice(0, 3).join(', ')}.`,
    },
    items: picks.map((article) => {
      const text = `${article.title} ${article.snippet ?? ''}`
      // Whole-word match, so "Rust" doesn't match "trust".
      const topic = profile.topics.find((t) =>
        new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(text),
      )
      return {
        article,
        headline: article.title,
        blurb: article.snippet?.slice(0, 280) ?? '',
        whyYou: topic ? `Matches your interest in ${topic}.` : 'One of today’s most-read tech stories.',
      }
    }),
  }
}
