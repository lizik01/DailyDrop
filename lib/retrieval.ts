import { and, desc, gt, notInArray, sql, type SQL } from 'drizzle-orm'
import { articles, db } from '@/lib/db'

export type Candidate = {
  id: string
  title: string
  source: string
  url: string
  snippet: string | null
  publishedAt: Date
}

const FRESH_HOURS = 36

// Same expression as the GIN index in schema.ts, so Postgres can use the index.
const document = sql`to_tsvector('english', ${articles.title} || ' ' || coalesce(${articles.snippet}, ''))`

/** ["Rust", "LLM inference"] → websearch query "Rust OR LLM inference" (words inside a topic are ANDed). */
const anyOf = (terms: string[]) =>
  terms
    .map((t) => t.replace(/["():&|!-]/g, ' ').replace(/\bor\b/gi, ' ').trim())
    .filter(Boolean)
    .join(' OR ')

const columns = {
  id: articles.id,
  title: articles.title,
  source: articles.source,
  url: articles.url,
  snippet: articles.snippet,
  publishedAt: articles.publishedAt,
}

/** Recent, not yet sent to this subscriber, and not matching their avoid list. */
function eligible(subscriberId: string, avoid: string[]) {
  const filters: SQL[] = [
    gt(articles.publishedAt, new Date(Date.now() - FRESH_HOURS * 3_600_000)),
    sql`${articles.id} not in (
      select di.article_id from digest_items di
      join digests d on d.id = di.digest_id
      where d.subscriber_id = ${subscriberId}
    )`,
  ]
  const avoidQuery = anyOf(avoid)
  if (avoidQuery) filters.push(sql`not (${document} @@ websearch_to_tsquery('english', ${avoidQuery}))`)
  return filters
}

/** Postgres full-text search, ranked by ts_rank. Used for the shortlist and as the editor agent's tool. */
export async function searchArticles(opts: { subscriberId: string; terms: string[]; avoid: string[]; limit: number }) {
  const query = anyOf(opts.terms)
  if (!query) return []
  const tsquery = sql`websearch_to_tsquery('english', ${query})`

  return db
    .select(columns)
    .from(articles)
    .where(and(...eligible(opts.subscriberId, opts.avoid), sql`${document} @@ ${tsquery}`))
    .orderBy(desc(sql`ts_rank(${document}, ${tsquery})`), desc(articles.publishedAt))
    .limit(opts.limit)
}

/** The editor's starting shortlist: topic matches first, topped up with the newest stories on a slow news day. */
export async function findCandidates(opts: { subscriberId: string; topics: string[]; avoid: string[]; limit: number }) {
  const matched = await searchArticles({ ...opts, terms: opts.topics })
  if (matched.length >= opts.limit) return matched

  const filters = eligible(opts.subscriberId, opts.avoid)
  if (matched.length) filters.push(notInArray(articles.id, matched.map((m) => m.id)))
  const latest = await db
    .select(columns)
    .from(articles)
    .where(and(...filters))
    .orderBy(desc(articles.publishedAt))
    .limit(opts.limit - matched.length)
  return [...matched, ...latest]
}
