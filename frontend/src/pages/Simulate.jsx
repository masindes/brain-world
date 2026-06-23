import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'

const REGIONS        = ['USA', 'EUR', 'ASI', 'AUS', 'JPN']
const UNIVERSES      = ['TOP3000', 'TOP2000', 'TOP1000', 'TOP500', 'TOP200']
const NEUTRALIZATIONS = ['NONE', 'MARKET', 'SECTOR', 'INDUSTRY', 'SUBINDUSTRY']

const DEFAULTS = {
  expression:    '',
  region:        'USA',
  universe:      'TOP3000',
  delay:         1,
  decay:         6,
  truncation:    0.1,
  neutralization:'SUBINDUSTRY',
  pasteurization:'ON',
  nan_handling:  'OFF',
}

function StatCard({ label, value, highlight }) {
  const display = value === null || value === undefined ? '—'
    : typeof value === 'number' ? value.toFixed(4)
    : String(value)

  return (
    <div className="card p-4 flex flex-col gap-1">
      <span className="text-xs text-fg-muted uppercase tracking-wide">{label}</span>
      <span className={`text-xl font-semibold ${highlight ? 'text-success' : 'text-fg'}`}>
        {display}
      </span>
    </div>
  )
}

export default function Simulate() {
  const [searchParams] = useSearchParams()
  const [form, setForm]     = useState({ ...DEFAULTS, expression: searchParams.get('expression') || '' })
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState(null)

  function set(key, val) { setForm(f => ({ ...f, [key]: val })) }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.expression.trim()) { setError('Expression is required.'); return }
    setLoading(true)
    setError(null)
    setResult(null)

    const res = await fetch('/api/simulate', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) { setError(data.error); return }
    setResult(data)
  }

  const sharpeColor = result?.sharpe >= 1.25 ? 'text-success' : result?.sharpe < 0 ? 'text-danger' : 'text-fg'

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-lg font-semibold text-fg">▶ Simulate Alpha</h1>

      <form onSubmit={handleSubmit} className="card p-5 space-y-4">
        {/* Expression */}
        <div>
          <label className="block text-sm text-fg-muted mb-1">
            Alpha expression <span className="text-danger">*</span>
          </label>
          <textarea
            className="input font-mono text-xs min-h-[80px] resize-y"
            placeholder='rank(ts_mean(close, 5) / ts_mean(close, 20))'
            value={form.expression}
            onChange={e => set('expression', e.target.value)}
            required
          />
        </div>

        {/* Row 1: Region, Universe, Delay */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-fg-muted mb-1">Region</label>
            <select className="select" value={form.region} onChange={e => set('region', e.target.value)}>
              {REGIONS.map(r => <option key={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-fg-muted mb-1">Universe</label>
            <select className="select" value={form.universe} onChange={e => set('universe', e.target.value)}>
              {UNIVERSES.map(u => <option key={u}>{u}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-fg-muted mb-1">Delay</label>
            <select className="select" value={form.delay} onChange={e => set('delay', Number(e.target.value))}>
              <option value={0}>0</option>
              <option value={1}>1</option>
            </select>
          </div>
        </div>

        {/* Row 2: Decay, Truncation, Neutralization */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-fg-muted mb-1">Decay</label>
            <input type="number" className="input" min={0} max={200} value={form.decay}
              onChange={e => set('decay', Number(e.target.value))} />
          </div>
          <div>
            <label className="block text-xs text-fg-muted mb-1">Truncation</label>
            <input type="number" className="input" min={0} max={1} step={0.01} value={form.truncation}
              onChange={e => set('truncation', Number(e.target.value))} />
          </div>
          <div>
            <label className="block text-xs text-fg-muted mb-1">Neutralization</label>
            <select className="select" value={form.neutralization}
              onChange={e => set('neutralization', e.target.value)}>
              {NEUTRALIZATIONS.map(n => <option key={n}>{n}</option>)}
            </select>
          </div>
        </div>

        {/* Row 3: Pasteurization, NaN Handling */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-fg-muted mb-1">Pasteurization</label>
            <select className="select" value={form.pasteurization}
              onChange={e => set('pasteurization', e.target.value)}>
              <option>ON</option><option>OFF</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-fg-muted mb-1">NaN Handling</label>
            <select className="select" value={form.nan_handling}
              onChange={e => set('nan_handling', e.target.value)}>
              <option>OFF</option><option>ON</option>
            </select>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-md bg-red-900/20 border border-danger/40 text-sm text-danger">{error}</div>
        )}

        <button type="submit" disabled={loading} className="btn-primary w-full justify-center">
          {loading ? (
            <span className="flex items-center gap-2">
              <span className="inline-block w-4 h-4 border-2 border-canvas border-t-accent rounded-full animate-spin" />
              Simulating… (this can take up to 5 min)
            </span>
          ) : '▶ Run simulation'}
        </button>
      </form>

      {/* Results */}
      {result && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-fg">Results</h2>
            <span className={`badge ${result.passed_checks === result.total_checks ? 'bg-green-900/40 text-success border border-success/30' : 'bg-red-900/30 text-danger border border-danger/30'}`}>
              {result.passed_checks}/{result.total_checks} checks passed
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Sharpe"   value={result.sharpe}   highlight={result.sharpe >= 1.25} />
            <StatCard label="Fitness"  value={result.fitness}  highlight={result.fitness > 1} />
            <StatCard label="Turnover" value={result.turnover} />
            <StatCard label="Weight check" value={result.weight_check} highlight={result.weight_check === 'PASS'} />
          </div>

          <div className="card p-4 flex flex-col gap-1">
            <span className="text-xs text-fg-muted uppercase tracking-wide">Alpha link</span>
            <a
              href={result.link}
              target="_blank"
              rel="noreferrer"
              className="text-accent hover:underline text-sm break-all"
            >
              {result.link}
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
