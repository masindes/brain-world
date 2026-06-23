import { useState, useCallback, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

const REGIONS    = ['USA', 'EUR', 'ASI', 'AUS', 'JPN']
const UNIVERSES  = ['TOP3000', 'TOP2000', 'TOP1000', 'TOP500', 'TOP200']

export default function Fields() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [params, setParams] = useState({
    dataset_id: searchParams.get('dataset_id') || '',
    region:     searchParams.get('region')     || 'USA',
    universe:   searchParams.get('universe')   || 'TOP3000',
    delay:      searchParams.get('delay')      || '1',
    search:     '',
  })
  const [results, setResults]   = useState(null)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState(null)

  const change = useCallback((key, val) => setParams(p => ({ ...p, [key]: val })), [])

  async function search() {
    if (!params.dataset_id.trim()) { setError('Dataset ID is required.'); return }
    setLoading(true)
    setError(null)
    const qs = new URLSearchParams(params).toString()
    const res = await fetch(`/api/fields?${qs}`, { credentials: 'include' })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) { setError(data.error); return }
    setResults(data)
  }

  // Auto-fetch if dataset_id was passed via URL
  useEffect(() => {
    if (params.dataset_id) search()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function useInSimulate(fieldId) {
    navigate(`/simulate?expression=${encodeURIComponent(fieldId)}`)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-fg">🔍 Data Fields</h1>
        {results && (
          <span className="badge bg-canvas border border-border text-fg-muted">
            {results.length} field{results.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-2 items-center">
        <input
          className="input w-44"
          placeholder="Dataset ID *"
          value={params.dataset_id}
          onChange={e => change('dataset_id', e.target.value)}
          onKeyDown={e => e.key === 'Enter' && search()}
        />
        <input
          className="input w-52"
          placeholder="Search fields…"
          value={params.search}
          onChange={e => change('search', e.target.value)}
          onKeyDown={e => e.key === 'Enter' && search()}
        />
        <select className="select w-28" value={params.region}
          onChange={e => change('region', e.target.value)}>
          {REGIONS.map(r => <option key={r}>{r}</option>)}
        </select>
        <select className="select w-32" value={params.universe}
          onChange={e => change('universe', e.target.value)}>
          {UNIVERSES.map(u => <option key={u}>{u}</option>)}
        </select>
        <select className="select w-28" value={params.delay}
          onChange={e => change('delay', e.target.value)}>
          <option value="0">Delay 0</option>
          <option value="1">Delay 1</option>
        </select>
        <button className="btn-primary" onClick={search} disabled={loading}>
          {loading ? 'Loading…' : '🔍 Search'}
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-md bg-red-900/20 border border-danger/40 text-sm text-danger">{error}</div>
      )}

      {results === null && !loading && (
        <div className="flex flex-col items-center justify-center py-20 text-fg-subtle">
          <span className="text-4xl mb-3">🔍</span>
          <p>Enter a Dataset ID and click Search — or browse from the Datasets page.</p>
        </div>
      )}

      {results && results.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-fg-subtle">
          <p>No fields matched your search.</p>
        </div>
      )}

      {results && results.length > 0 && (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead className="bg-canvas border-b border-border">
              <tr>
                <th className="th">Field ID</th>
                <th className="th">Description</th>
                <th className="th">Type</th>
                <th className="th">Coverage</th>
                <th className="th"></th>
              </tr>
            </thead>
            <tbody>
              {results.map(f => (
                <tr key={f.id} className="table-row">
                  <td className="td"><code className="text-accent text-xs">{f.id}</code></td>
                  <td className="td text-fg max-w-xs truncate" title={f.description}>{f.description || '—'}</td>
                  <td className="td">
                    {f.type
                      ? <span className="badge bg-canvas border border-border text-fg-muted">{f.type}</span>
                      : <span className="text-fg-subtle">—</span>}
                  </td>
                  <td className="td text-fg-muted">{f.coverage ?? '—'}</td>
                  <td className="td text-right">
                    <button
                      className="btn-ghost text-xs"
                      onClick={() => useInSimulate(f.id)}
                      title="Use this field in Simulate"
                    >
                      ▶ Simulate
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
