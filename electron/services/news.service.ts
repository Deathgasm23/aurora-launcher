import { NewsItem } from '../../shared/types'

function parseRSS(xml: string): NewsItem[] {
  const items: NewsItem[] = []
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi
  let match
  while ((match = itemRegex.exec(xml)) !== null) {
    const content = match[1]
    const title = content.match(/<title[^>]*>([^<]*)<\/title>/)?.[1]?.trim() || 'Minecraft Update'
    const link = content.match(/<link[^>]*>([^<]*)<\/link>/)?.[1]?.trim() || '#'
    const description = content.match(/<description[^>]*>([^<]*)<\/description>/)?.[1]?.trim() || ''
    const pubDateStr = content.match(/<pubDate[^>]*>([^<]*)<\/pubDate>/)?.[1]?.trim()
    items.push({
      title,
      link,
      description,
      pubDate: pubDateStr ? new Date(pubDateStr).toISOString() : new Date().toISOString(),
    })
  }
  return items
}

const FETCH_TIMEOUT = 8000

const fetchWithTimeout = async (url: string, fetch: any) => {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT)
  try {
    return await fetch(url, { signal: controller.signal })
  } finally {
    clearTimeout(timeout)
  }
}

export class NewsService {
  async fetchNews(): Promise<NewsItem[]> {
    const fetch = (await import('node-fetch')).default
    const allItems: NewsItem[] = []

    const results = await Promise.allSettled([
      this.fetchMojangNews(fetch),
      this.fetchBlogRSS(fetch),
    ])

    for (const result of results) {
      if (result.status === 'fulfilled') allItems.push(...result.value)
    }

    if (allItems.length === 0) {
      return [{
        title: 'Minecraft Java Edition',
        link: 'https://www.minecraft.net',
        description: 'Welcome to Aurora Launcher. News feed unavailable.',
        pubDate: new Date().toISOString(),
      }]
    }

    allItems.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime())
    return allItems
  }

  private async fetchMojangNews(fetch: any): Promise<NewsItem[]> {
    try {
      const response = await fetchWithTimeout('https://launchercontent.mojang.com/v2/javaPatchNotes.json', fetch)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const data: any = await response.json()
      if (!data.entries) return []
      return data.entries.map((entry: any) => ({
        title: entry.title || 'Minecraft Update',
        link: entry.version ? `https://www.minecraft.net/en-us/article/minecraft-${entry.version.replace(/\./g, '-')}` : '#',
        description: entry.shortText || entry.title || '',
        pubDate: entry.date || new Date().toISOString(),
      }))
    } catch {
      return []
    }
  }

  private async fetchBlogRSS(fetch: any): Promise<NewsItem[]> {
    try {
      const response = await fetchWithTimeout('https://www.minecraft.net/en-us/feeds/minecraft-blog/rss', fetch)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      return parseRSS(await response.text())
    } catch {
      return []
    }
  }
}
