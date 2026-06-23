import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'

const PERIODS = [
  { label: '1M', value: '1mo' },
  { label: '3M', value: '3mo' },
  { label: '6M', value: '6mo' },
  { label: '1Y', value: '1y'  },
  { label: '2Y', value: '2y'  },
  { label: '5Y', value: '5y'  },
]

function fmt(n, decimals = 2) {
  if (n == null) return '—'
  if (Math.abs(n) >= 1e12) return (n / 1e12).toFixed(2) + 'T'
  if (Math.abs(n) >= 1e9)  return (n / 1e9).toFixed(2) + 'B'
  if (Math.abs(n) >= 1e6)  return (n / 1e6).toFixed(2) + 'M'
  return Number(n).toFixed(decimals)
}

function InfoRow({ label, value }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-border/50 last:border-0">
      <span className="text-xs text-fg-muted">{label}</span>
      <span className="text-xs font-medium text-fg">{value ?? '—'}</span>
    </div>
  )
}

function MiniChart({ rows }) {
  if (!rows || rows.length === 0) return null
  const closes = rows.map(r => r.close)
  const min = Math.min(...closes)
  const max = Math.max(...closes)
  const range = max - min || 1
  const W = 600, H = 120, PAD = 4
  const pts = rows.map((r, i) => {
    const x = PAD + (i / (rows.length - 1)) * (W - PAD * 2)
    const y = H - PAD - ((r.close - min) / range) * (H - PAD * 2)
    return `${x},${y}`
  }).join(' ')
  const first = closes[0], last = closes[closes.length - 1]
  const up = last >= first

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-28" preserveAspectRatio="none">
      <polyline
        points={pts}
        fill="none"
        stroke={up ? '#3fb950' : '#f85149'}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export default function MarketData() {
  const navigate = useNavigate()
  const [avOk, setAvOk]         = useState(null)
  const [query, setQuery]       = useState('')
  const [suggestions, setSugg]  = useState([])
  const [symbol, setSymbol]     = useState('')
  const [quote, setQuote]       = useState(null)
  const [history, setHistory]   = useState([])
  const [period, setPeriod]     = useState('6mo')
  const [loading, setLoading]   = useState(false)
  const [histLoading, setHistL] = useState(false)
  const [error, setError]       = useState(null)

  useEffect(() => {
    fetch('/api/market/av-key', { credentials: 'include' })
      .then(r => r.json()).then(d => setAvOk(d.configured)).catch(() => setAvOk(false))
  }, [])

  async function handleSearch(e) {
    e.preventDefault()
    if (!query.trim()) return
    setLoading(true)
    setError(null)
    setQuote(null)
    setHistory([])
    setSugg([])

    // Try direct ticker lookup first, then search
    const sym = query.trim().toUpperCase()
    const res = await fetch(`/api/market/quote?symbol=${encodeURIComponent(sym)}`, { credentials: 'include' })
    const data = await res.json()
    setLoading(false)

    if (res.ok) {
      setSymbol(sym)
      setQuote(data)
      fetchHistory(sym, period)
    } else {
      // Try search suggestions
      const sRes = await fetch(`/api/market/search?q=${encodeURIComponent(query)}`, { credentials: 'include' })
      const sData = await sRes.json()
      if (sRes.ok && sData.length > 0) {
        setSugg(sData)
      } else {
        setError(data.error || 'No results found.')
      }
    }
  }

  async function selectSuggestion(sym) {
    setQuery(sym)
    setSugg([])
    setLoading(true)
    setError(null)
    const res = await fetch(`/api/market/quote?symbol=${encodeURIComponent(sym)}`, { credentials: 'include' })
    const data = await res.json()
    setLoading(false)
    if (res.ok) {
      setSymbol(sym)
      setQuote(data)
      fetchHistory(sym, period)
    } else {
      setError(data.error)
    }
  }

  async function fetchHistory(sym, p) {
    setHistL(true)
    const res = await fetch(`/api/market/history?symbol=${encodeURIComponent(sym)}&period=${p}`, { credentials: 'include' })
    const data = await res.json()
    setHistL(false)
    if (res.ok) setHistory(data)
  }

  async function changePeriod(p) {
    setPeriod(p)
    if (symbol) fetchHistory(symbol, p)
  }

  function useInSimulate() {
    navigate(`/simulate?expression=${encodeURIComponent(symbol.toLowerCase())}`)
  }

  const up = quote && quote.change != null ? quote.change >= 0 : null

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-fg">📈 Market Data</h1>
        <p className="text-sm text-fg-muted mt-0.5">
          Search stocks, ETFs and indices — powered by Alpha Vantage.
        </p>
      </div>

      {avOk === false && (
        <div className="flex items-center justify-between p-4 rounded-lg border border-warning/40 bg-yellow-900/10">
          <div className="flex items-center gap-3">
            <span>⚠</span>
            <div>
              <p className="text-sm text-warning font-medium">Alpha Vantage API key not configured</p>
              <p className="text-xs text-fg-muted mt-0.5">Free key at alphavantage.co — takes 20 seconds to get.</p>
            </div>
          </div>
          <Link to="/setup" className="btn-primary text-xs whitespace-nowrap">Configure →</Link>
        </div>
      )}

      {/* Search bar */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1 max-w-sm">
          <input
            className="input pr-10"
            placeholder="Ticker or company name (e.g. AAPL, Tesla)"
            value={query}
            onChange={e => { setQuery(e.target.value); setSugg([]) }}
          />
        </div>
        <button type="submit" disabled={loading} className="btn-primary px-5">
          {loading
            ? <span className="flex items-center gap-2">
                <span className="inline-block w-4 h-4 border-2 border-canvas/40 border-t-canvas rounded-full animate-spin" />
                Fetching…
              </span>
            : '🔍 Search'}
        </button>
      </form>

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <div className="card overflow-hidden max-w-sm">
          <p className="px-3 py-2 text-xs text-fg-muted border-b border-border">Did you mean…</p>
          {suggestions.map(s => (
            <button
              key={s.symbol}
              onClick={() => selectSuggestion(s.symbol)}
              className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-canvas transition-colors border-b border-border/40 last:border-0"
            >
              <span>
                <code className="text-accent text-xs font-bold">{s.symbol}</code>
                <span className="text-fg text-xs ml-2">{s.name}</span>
              </span>
              <span className="text-xs text-fg-subtle">{s.exchange}</span>
            </button>
          ))}
        </div>
      )}

      {error && (
        <div className="p-3 rounded-md border border-danger/40 bg-red-900/10 text-danger text-sm">
          ⚠ {error}
        </div>
      )}

      {/* Quote card */}
      {quote && (
        <div className="space-y-4">
          {/* Header */}
          <div className="card p-5">
            <div className="flex items-start justify-between flex-wrap gap-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-2xl font-bold text-accent">{quote.symbol}</span>
                  <span className="badge bg-canvas border border-border text-fg-muted">{quote.exchange}</span>
                </div>
                <p className="text-sm text-fg-muted">{quote.name}</p>
                {quote.sector && (
                  <p className="text-xs text-fg-subtle mt-0.5">{quote.sector} · {quote.industry}</p>
                )}
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-fg">
                  {quote.currency === 'USD' ? '$' : ''}{fmt(quote.price, 2)}
                </p>
                {up !== null && (
                  <p className={`text-sm font-medium mt-0.5 ${up ? 'text-success' : 'text-danger'}`}>
                    {up ? '▲' : '▼'} {Math.abs(quote.change).toFixed(2)} ({Math.abs(quote.change_pct).toFixed(2)}%)
                  </p>
                )}
              </div>
            </div>

            {/* Chart */}
            <div className="mt-4">
              <div className="flex gap-1 mb-2">
                {PERIODS.map(p => (
                  <button
                    key={p.value}
                    onClick={() => changePeriod(p.value)}
                    className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                      period === p.value
                        ? 'bg-accent text-canvas'
                        : 'text-fg-muted hover:text-fg hover:bg-canvas'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              {histLoading
                ? <div className="h-28 flex items-center justify-center">
                    <span className="inline-block w-5 h-5 border-2 border-border border-t-accent rounded-full animate-spin" />
                  </div>
                : <MiniChart rows={history} />
              }
            </div>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="card p-4">
              <p className="text-xs font-semibold text-fg-muted uppercase tracking-wider mb-3">Price & Volume</p>
              <InfoRow label="Previous Close"    value={quote.previous_close != null ? `$${fmt(quote.previous_close)}` : null} />
              <InfoRow label="52-Week High"      value={quote.fifty_two_week_high != null ? `$${fmt(quote.fifty_two_week_high)}` : null} />
              <InfoRow label="52-Week Low"       value={quote.fifty_two_week_low != null ? `$${fmt(quote.fifty_two_week_low)}` : null} />
              <InfoRow label="Volume"            value={quote.volume != null ? fmt(quote.volume, 0) : null} />
              <InfoRow label="Avg Volume"        value={quote.avg_volume != null ? fmt(quote.avg_volume, 0) : null} />
              <InfoRow label="Market Cap"        value={quote.market_cap != null ? `$${fmt(quote.market_cap)}` : null} />
            </div>
            <div className="card p-4">
              <p className="text-xs font-semibold text-fg-muted uppercase tracking-wider mb-3">Fundamentals</p>
              <InfoRow label="P/E Ratio (TTM)"   value={quote.pe_ratio != null ? fmt(quote.pe_ratio) : null} />
              <InfoRow label="Forward P/E"       value={quote.forward_pe != null ? fmt(quote.forward_pe) : null} />
              <InfoRow label="EPS (TTM)"         value={quote.eps != null ? `$${fmt(quote.eps)}` : null} />
              <InfoRow label="Dividend Yield"    value={quote.dividend_yield != null ? `${(quote.dividend_yield * 100).toFixed(2)}%` : null} />
              <InfoRow label="Beta"              value={quote.beta != null ? fmt(quote.beta) : null} />
              <InfoRow label="Currency"          value={quote.currency} />
            </div>
          </div>

          {/* Description */}
          {quote.summary && (
            <div className="card p-4">
              <p className="text-xs font-semibold text-fg-muted uppercase tracking-wider mb-2">About</p>
              <p className="text-xs text-fg-muted leading-relaxed line-clamp-4">{quote.summary}</p>
            </div>
          )}

          {/* Price history table */}
          {history.length > 0 && (
            <div className="card overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <p className="text-xs font-semibold text-fg-muted uppercase tracking-wider">Price History</p>
                <button
                  onClick={useInSimulate}
                  className="btn-primary text-xs"
                >
                  ▶ Use in Simulate
                </button>
              </div>
              <div className="overflow-x-auto max-h-64 overflow-y-auto">
                <table className="w-full">
                  <thead className="bg-canvas border-b border-border sticky top-0">
                    <tr>
                      <th className="th">Date</th>
                      <th className="th text-right">Open</th>
                      <th className="th text-right">High</th>
                      <th className="th text-right">Low</th>
                      <th className="th text-right">Close</th>
                      <th className="th text-right">Volume</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...history].reverse().map(row => (
                      <tr key={row.date} className="table-row">
                        <td className="td text-fg-muted text-xs">{row.date}</td>
                        <td className="td text-right text-xs">${fmt(row.open)}</td>
                        <td className="td text-right text-xs text-success">${fmt(row.high)}</td>
                        <td className="td text-right text-xs text-danger">${fmt(row.low)}</td>
                        <td className="td text-right text-xs font-medium text-fg">${fmt(row.close)}</td>
                        <td className="td text-right text-xs text-fg-muted">{fmt(row.volume, 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {!quote && !loading && suggestions.length === 0 && !error && (
        <div className="flex flex-col items-center justify-center py-20 text-fg-subtle">
          <span className="text-4xl mb-3">📈</span>
          <p className="text-sm">Enter a ticker symbol or company name and click Search.</p>
          <p className="text-xs mt-1 text-fg-subtle">Examples: AAPL, MSFT, TSLA, SPY, BTC-USD</p>
        </div>
      )}
    </div>
  )
}
