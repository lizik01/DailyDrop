# DailyDrop

An AI tech-news digest. You describe your interests in plain words. Every morning, in your timezone, an AI editor picks and writes up the stories you care about, and Resend delivers them.

**Stack:** Next.js 16 · PostgreSQL · Drizzle · Vercel AI SDK · Inngest · Resend · React Email · Tailwind

## How it works

```
signup ─► LLM: plain text → profile {topics, avoid, tone} ─► subscribers

Inngest cron, hourly:     RSS feeds ─► articles

Inngest cron, hourly:     who's due at this local hour? ─► fan out: one event per subscriber
                                                               │
build-digest (one subscriber, one day)                         ▼
  step 1  write-digest   full-text search shortlist ─► editor agent (1 tool, ≤4 steps)
                         ─► Zod + ref validation, retry once ─► template fallback if both fail
                         ─► saved to Postgres
  step 2  send-email     Resend (idempotency key) ─► digests.status = sent

Resend webhooks ─► email_events ─► digests.status: delivered → opened / bounced / complained
```

## Code map

### 1. Plain-text interests → structured profile → personalized email

- `lib/ai/profile.ts`: turns "backend dev into Rust and LLM infra, no crypto" into `{ summary, topics[], avoid[], tone }`. If the LLM fails, it falls back to splitting the user's own words into topics, so signup still works.
- `lib/retrieval.ts`: Postgres full-text search (`websearch_to_tsquery` + `ts_rank`, GIN index) over the last 36 hours. It skips stories already sent and anything on the avoid list. On a slow news day it fills the list with the newest stories.
- `emails/DailyDigest.tsx`: React Email template, sent by Resend.

### 2. The LLM harness (`lib/ai/harness.ts`)

Every LLM call goes through `generateStructured()`:

| Concern | How |
| --- | --- |
| Structured output | `generateText` + `Output.object({ schema })`, where the schema is Zod |
| Checks Zod can't express | `validate` callback, e.g. "every `ref` must be a real candidate, used once" |
| Retry | On a parse failure, a `validate` rejection, or a provider error, retry once with the error added to the prompt |
| Bounded agent | `stopWhen: stepCountIs(maxSteps)`. The editor gets 4 steps and one tool, `searchArticles` |
| Fallback | The harness never throws. It returns `{ ok: false }`, and the caller decides what to do (`templateDigest()` in `lib/ai/editor.ts`) |
| Logging | One `llm_calls` row per attempt: purpose, model, attempt, ok, error, tokens, steps, latency |

The editor (`lib/ai/editor.ts`) refers to articles by short refs (`a1`, `a2`…) instead of UUIDs, so the model can't make up an id we wouldn't catch.

Useful queries:

```sql
-- tokens and failure rate per purpose, last 7 days
select purpose, count(*) as calls, sum(input_tokens) as input, sum(output_tokens) as output,
       round(avg(latency_ms)) as avg_ms, avg((not ok)::int) as fail_rate
from llm_calls where created_at > now() - interval '7 days' group by purpose;

-- how often the template fallback was used
select source, count(*) from digests group by source;
```

### 3. Inngest orchestration + Resend webhooks

| Function | Trigger | Why it's built this way |
| --- | --- | --- |
| `ingest-news` | cron `0 * * * *` | One step per feed, so a failing feed retries alone |
| `schedule-digests` | cron `5 * * * *` | Timezone-aware: compares each subscriber's local hour with their `send_hour`, then fans out one event each |
| `build-digest` | `digest/requested` | Two steps. Step 1 saves the AI output and returns only its id. If step 2 (send) fails, Inngest reruns step 2 alone and the LLM does not run again. Also idempotent per subscriber per day, with concurrency 5 |
| `onboard-subscriber` | `subscriber/created` | Welcome email, then the first digest right away |

Duplicate sends are blocked at three levels: Inngest `idempotency` on subscriber + day, a unique `(subscriber_id, day)` row, and a Resend `idempotencyKey` per digest.

`app/api/webhooks/resend/route.ts`:
- verifies the webhook signature
- stores each event once, keyed on `svix-id`, because Resend retries webhooks
- moves `digests.status` only forward, because events can arrive out of order
- stops sending to a subscriber after a hard bounce or a spam complaint

## Running locally

```bash
cp .env.example .env            # AI_GATEWAY_API_KEY, RESEND_API_KEY
docker compose up -d            # Postgres 17
npm install
npm run db:migrate
npm run dev                     # http://localhost:3000
npm run inngest:dev             # Inngest dev UI at http://localhost:8288
```

In the Inngest UI, invoke `ingest-news` once to load articles, then sign up on the homepage. The first digest is sent right away.

For webhooks, expose port 3000 (e.g. `ngrok http 3000`), add `https://…/api/webhooks/resend` as a webhook in Resend, and copy its signing secret into `RESEND_WEBHOOK_SECRET`.

## Layout

```
app/
  page.tsx, signup-form.tsx, actions.ts   signup + settings server actions
  me/[subscriberId]/                      profile, recent digests, settings (signed link)
  api/inngest/                            Inngest endpoint
  api/webhooks/resend/                    delivery tracking
  api/unsubscribe/[subscriberId]/         one-click unsubscribe
lib/
  ai/harness.ts, profile.ts, editor.ts    LLM layer
  inngest/client.ts, functions/           workflows
  db/schema.ts                            tables
  retrieval.ts, sources.ts, links.ts, time.ts
emails/                                   React Email templates
drizzle/                                  SQL migration
```

Started from [AlexCo888/ai-newsletters-generator](https://github.com/AlexCo888/ai-newsletters-generator). Auth, billing and Supabase were removed. Signed email links replace accounts, and Inngest replaces Vercel cron.
