import { articles, db } from '@/lib/db'
import { FEEDS, fetchFeed } from '@/lib/sources'
import { inngest } from '../client'

/** Hourly: pull every RSS feed and store new articles. A failing feed is skipped, not fatal. */
export const ingestNews = inngest.createFunction(
  { id: 'ingest-news', triggers: [{ cron: '0 * * * *' }], concurrency: 1 },
  async ({ step, logger }) => {
    // One step per feed: Inngest retries a failed feed on its own without refetching the rest.
    const perFeed = await Promise.all(
      FEEDS.map((feed) =>
        step.run(`fetch-${feed.name}`, async () => {
          try {
            return await fetchFeed(feed)
          } catch (error) {
            logger.warn(`Feed failed: ${feed.name}`, error)
            return []
          }
        }),
      ),
    )

    const stored = await step.run('store-articles', async () => {
      const rows = [...new Map(perFeed.flat().map((a) => [a.url, a])).values()]
      if (!rows.length) return 0
      const inserted = await db
        .insert(articles)
        .values(rows.map((a) => ({ ...a, publishedAt: new Date(a.publishedAt) })))
        .onConflictDoNothing({ target: articles.url })
        .returning({ id: articles.id })
      return inserted.length
    })

    return { fetched: perFeed.flat().length, stored }
  },
)
