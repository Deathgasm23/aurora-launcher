import { useState, useEffect } from 'react'
import { ExternalLink, ChevronDown, ChevronRight, Newspaper, Clock, ChevronLeft, ChevronsLeft, ChevronsRight } from 'lucide-react'
import type { NewsItem } from '../../shared/types'

const PER_PAGE = 5

export default function NewsPage() {
  const [news, setNews] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [expanded, setExpanded] = useState<Set<number>>(new Set())

  useEffect(() => {
    loadNews()
    window.electronAPI.news.onNewsUpdated((items) => {
      setNews(items)
      setLoading(false)
    })
    return () => {
      window.electronAPI.news.removeNewsUpdatedListener()
    }
  }, [])

  async function loadNews() {
    setLoading(true)
    try {
      const items = await window.electronAPI.news.getNews()
      setNews(items)
    } catch {}
    setLoading(false)
  }

  const totalPages = Math.max(1, Math.ceil(news.length / PER_PAGE))
  const clampedPage = Math.min(page, totalPages - 1)
  const pageItems = news.slice(clampedPage * PER_PAGE, (clampedPage + 1) * PER_PAGE)

  function toggleExpand(i: number) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">News</h1>
        <p className="page-subtitle">Latest Minecraft updates and announcements
          <button className="btn btn-ghost btn-xs" style={{ marginLeft: 8, verticalAlign: 'middle' }}
            onClick={() => window.electronAPI.shell.openExternal('https://www.minecraft.net/en-us/article')}>
            <ExternalLink size={11} /> View all articles
          </button>
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center" style={{ padding: 64 }}><div className="spinner" /></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {news.length === 0 ? (
            <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
              <Newspaper size={32} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
              <div>No news available.</div>
            </div>
          ) : (
            <>
              {pageItems.map((item, i) => {
                const globalIdx = clampedPage * PER_PAGE + i
                return (
                  <div key={globalIdx} className="card news-card" style={{ padding: 0, overflow: 'hidden' }}>
                    <button className="collapsible-header" onClick={() => toggleExpand(globalIdx)}
                      style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-primary)', fontSize: 14, fontWeight: 600, textAlign: 'left' }}>
                      {expanded.has(globalIdx) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer' }}
                        onClick={(e) => { e.stopPropagation(); window.electronAPI.shell.openExternal(item.link) }}
                        title="Open article">{item.title}</div>
                        <div className="flex items-center gap-2" style={{ marginTop: 2 }}>
                          <Clock size={11} style={{ color: 'var(--text-muted)' }} />
                          <span className="text-xs text-muted">{new Date(item.pubDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                        </div>
                      </div>
                      <button className="btn btn-ghost btn-xs" onClick={(e) => { e.stopPropagation(); window.electronAPI.shell.openExternal(item.link) }} title="Open article">
                        <ExternalLink size={12} />
                      </button>
                    </button>
                    {expanded.has(globalIdx) && (
                      <div className="collapsible-body" style={{ padding: '0 16px 12px' }}>
                        <p className="text-sm text-muted" style={{ lineHeight: 1.6 }}>{item.description}</p>
                      </div>
                    )}
                  </div>
                )
              })}

              {totalPages > 1 && (
                <div className="news-pagination">
                  <button className="btn btn-ghost btn-xs" disabled={clampedPage === 0} onClick={() => setPage(0)}><ChevronsLeft size={14} /></button>
                  <button className="btn btn-ghost btn-xs" disabled={clampedPage === 0} onClick={() => setPage(clampedPage - 1)}><ChevronLeft size={14} /></button>
                  {(() => {
                    const pages: (number | string)[] = []
                    if (totalPages <= 7) {
                      for (let i = 0; i < totalPages; i++) pages.push(i)
                    } else {
                      pages.push(0)
                      const nearStart = clampedPage <= 2
                      const nearEnd = clampedPage >= totalPages - 3
                      if (nearStart) {
                        for (let i = 1; i <= Math.min(3, totalPages - 2); i++) pages.push(i)
                        pages.push('...')
                      } else if (nearEnd) {
                        pages.push('...')
                        for (let i = totalPages - 4; i <= totalPages - 2; i++) pages.push(i)
                      } else {
                        pages.push('...')
                        pages.push(clampedPage - 1)
                        pages.push(clampedPage)
                        pages.push(clampedPage + 1)
                        pages.push('...')
                      }
                      pages.push(totalPages - 1)
                    }
                    return pages.map((p, idx) =>
                      p === '...' ? (
                        <span key={`e${idx}`} className="text-xs text-muted" style={{ padding: '0 2px' }}>...</span>
                      ) : (
                        <button key={p}
                          className={`btn btn-xs ${p === clampedPage ? 'btn-primary' : 'btn-ghost'}`}
                          onClick={() => setPage(p as number)}
                          style={{ minWidth: 28 }}
                        >
                          {(p as number) + 1}
                        </button>
                      )
                    )
                  })()}
                  <button className="btn btn-ghost btn-xs" disabled={clampedPage >= totalPages - 1} onClick={() => setPage(clampedPage + 1)}><ChevronRight size={14} /></button>
                  <button className="btn btn-ghost btn-xs" disabled={clampedPage >= totalPages - 1} onClick={() => setPage(totalPages - 1)}><ChevronsRight size={14} /></button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}