import { sql } from 'drizzle-orm'
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

export const subscriberStatus = pgEnum('subscriber_status', ['active', 'paused', 'unsubscribed', 'bounced'])
export const digestStatus = pgEnum('digest_status', [
  'generated',
  'sent',
  'delivered',
  'opened',
  'bounced',
  'complained',
  'failed',
])
/** Whether the issue was written by the editor agent or by the template fallback. */
export const digestSource = pgEnum('digest_source', ['llm', 'fallback'])

/** Structured profile the LLM extracts from the subscriber's plain-text interests. */
export type InterestProfile = {
  summary: string
  topics: string[]
  avoid: string[]
  tone: 'crisp' | 'friendly' | 'analytical'
}

export const subscribers = pgTable('subscribers', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  name: text('name'),
  /** What the user typed, e.g. "backend dev into Rust and LLM infra, no crypto". */
  interestPrompt: text('interest_prompt').notNull(),
  profile: jsonb('profile').$type<InterestProfile>().notNull(),
  timezone: text('timezone').notNull().default('America/New_York'),
  sendHour: smallint('send_hour').notNull().default(7),
  status: subscriberStatus('status').notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const articles = pgTable(
  'articles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    url: text('url').notNull().unique(),
    title: text('title').notNull(),
    source: text('source').notNull(),
    snippet: text('snippet'),
    publishedAt: timestamp('published_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('articles_published_idx').on(t.publishedAt),
    // Full-text search index; must match the expression in lib/retrieval.ts exactly.
    index('articles_search_idx').using('gin', sql`to_tsvector('english', ${t.title} || ' ' || coalesce(${t.snippet}, ''))`),
  ],
)

export type DigestContent = {
  subject: string
  intro: string
}

export const digests = pgTable(
  'digests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    subscriberId: uuid('subscriber_id')
      .notNull()
      .references(() => subscribers.id, { onDelete: 'cascade' }),
    /** Subscriber-local calendar day; one digest per subscriber per day. */
    day: date('day').notNull(),
    content: jsonb('content').$type<DigestContent>().notNull(),
    source: digestSource('source').notNull(),
    status: digestStatus('status').notNull().default('generated'),
    resendEmailId: text('resend_email_id'),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    openedAt: timestamp('opened_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('digests_subscriber_day_idx').on(t.subscriberId, t.day),
    index('digests_resend_email_idx').on(t.resendEmailId),
  ],
)

export const digestItems = pgTable(
  'digest_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    digestId: uuid('digest_id')
      .notNull()
      .references(() => digests.id, { onDelete: 'cascade' }),
    articleId: uuid('article_id')
      .notNull()
      .references(() => articles.id, { onDelete: 'cascade' }),
    position: smallint('position').notNull(),
    headline: text('headline').notNull(),
    blurb: text('blurb').notNull(),
    /** One line on why this story is in this subscriber's issue. */
    whyYou: text('why_you').notNull(),
  },
  (t) => [index('digest_items_digest_idx').on(t.digestId)],
)

export const emailEvents = pgTable(
  'email_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** svix-id header. Resend retries webhooks, so this makes the handler idempotent. */
    webhookId: text('webhook_id').notNull().unique(),
    resendEmailId: text('resend_email_id').notNull(),
    digestId: uuid('digest_id').references(() => digests.id, { onDelete: 'set null' }),
    type: text('type').notNull(),
    payload: jsonb('payload').notNull(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
  },
  (t) => [index('email_events_digest_idx').on(t.digestId)],
)

/** One row per LLM attempt, written by lib/ai/harness.ts. Used for cost reports and debugging. */
export const llmCalls = pgTable(
  'llm_calls',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** What the call was for: "profile" or "editor". */
    purpose: text('purpose').notNull(),
    model: text('model').notNull(),
    attempt: smallint('attempt').notNull(),
    ok: boolean('ok').notNull(),
    error: text('error'),
    inputTokens: integer('input_tokens'),
    outputTokens: integer('output_tokens'),
    /** Agent steps used (1 = answered without calling a tool). */
    steps: smallint('steps'),
    latencyMs: integer('latency_ms').notNull(),
    subscriberId: uuid('subscriber_id').references(() => subscribers.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('llm_calls_created_idx').on(t.createdAt)],
)

export type Subscriber = typeof subscribers.$inferSelect
export type Article = typeof articles.$inferSelect
