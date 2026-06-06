import { NewsItem } from '../../shared/types'

function parseRSS(xml: string): NewsItem[] {
  const items: NewsItem[] = []
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi
  let match
  while ((match = itemRegex.exec(xml)) !== null) {
    const content = match[1]
    const title = content.match(/<title[^>]*>([^<]*)<\/title>/)?.[1]?.trim() || 'Minecraft Update'
    const link = content.match(/<link[^>]*>([^<]*)<\/link>/)?.[1]?.trim() || 'https://www.minecraft.net/en-us/article'
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

const FETCH_TIMEOUT = 3000
const CACHE_TTL = 30 * 60 * 1000

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
  private cached: NewsItem[] | null = null
  private cacheTime = 0
  private pending: Promise<NewsItem[]> | null = null
  private onUpdate: ((items: NewsItem[]) => void) | null = null

  getCached(): NewsItem[] | null {
    return this.cached
  }

  onRefresh(cb: (items: NewsItem[]) => void) {
    this.onUpdate = cb
  }

  async fetchNews(): Promise<NewsItem[]> {
    const now = Date.now()
    if (this.cached && now - this.cacheTime < CACHE_TTL) {
      return this.cached
    }

    if (this.pending) return this.pending

    this.pending = this.doFetch()
    const result = await this.pending
    this.pending = null
    return result
  }

  private async doFetch(): Promise<NewsItem[]> {
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
      if (this.cached) return this.cached
      return [{
        title: 'Minecraft Java Edition',
        link: 'https://www.minecraft.net/en-us/article',
        description: 'Welcome to Aurora Launcher. News feed unavailable.',
        pubDate: new Date().toISOString(),
      }]
    }

    allItems.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime())
    this.cached = allItems
    this.cacheTime = Date.now()
    this.onUpdate?.(allItems)
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
        link: entry.title ? `https://www.minecraft.net/en-us/article/${entry.title.toLowerCase().replace(/[:\s.]+/g, '-').replace(/^-+|-+$/g, '')}` : 'https://www.minecraft.net/en-us/article',
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