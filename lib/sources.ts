import Parser from 'rss-parser'

export type RawArticle = {
  url: string
  title: string
  source: string
  snippet: string | null
  publishedAt: Date
}

// Mix of broad tech outlets and niche engineering blogs so every interest has candidates.
export const FEEDS: { name: string; url: string }[] = [
  { name: 'Hacker News', url: 'https://hnrss.org/frontpage?points=100' },
  { name: 'TechCrunch', url: 'https://techcrunch.com/feed/' },
  { name: 'The Verge', url: 'https://www.theverge.com/rss/index.xml' },
  { name: 'Ars Technica', url: 'https://feeds.arstechnica.com/arstechnica/technology-lab' },
  { name: 'MIT Technology Review', url: 'https://www.technologyreview.com/feed/' },
  { name: 'Simon Willison', url: 'https://simonwillison.net/atom/everything/' },
  { name: 'Hugging Face', url: 'https://huggingface.co/blog/feed.xml' },
  { name: 'GitHub Blog', url: 'https://github.blog/feed/' },
  { name: 'Cloudflare Blog', url: 'https://blog.cloudflare.com/rss/' },
  { name: 'Vercel', url: 'https://vercel.com/atom' },
  { name: 'Krebs on Security', url: 'https://krebsonsecurity.com/feed/' },
  { name: 'IEEE Spectrum', url: 'https://spectrum.ieee.org/feeds/feed.rss' },
]

const parser = new Parser({ timeout: 10_000 })
const MAX_AGE_MS = 48 * 60 * 60 * 1000

export async function fetchFeed(feed: { name: string; url: string }): Promise<RawArticle[]> {
  const parsed = await parser.parseURL(feed.url)
  const cutoff = Date.now() - MAX_AGE_MS
  return parsed.items.flatMap((item) => {
    const publishedAt = new Date(item.isoDate ?? item.pubDate ?? Date.now())
    if (!item.link || !item.title || publishedAt.getTime() < cutoff) return []
    const snippet = (item.contentSnippet ?? item.content ?? '').replace(/\s+/g, ' ').trim().slice(0, 1500)
    return [{ url: item.link, title: item.title.trim(), source: feed.name, snippet: snippet || null, publishedAt }]
  })
}
