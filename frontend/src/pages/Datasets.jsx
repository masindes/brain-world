import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'

const REGIONS    = ['USA', 'EUR', 'ASI', 'AUS', 'JPN']
const UNIVERSES  = ['TOP3000', 'TOP2000', 'TOP1000', 'TOP500', 'TOP200']

function FilterBar({ params, onChange, onSearch, loading }) {
  return (
    <div className="flex flex-wrap gap-2 items-center">
      <input
        className="input w-56"
        placeholder="Search datasets…"
        value={params.search}
        onChange={e => onChange('search', e.target.value)}
        onKeyDown={e => e.key === 'Enter' && onSearch()}
      />
      <select className="select w-28" value={params.region}
        onChange={e => onChange('region', e.target.value)}>
        {REGIONS.map(r => <option key={r}>{r}</option>)}
      </select>
      <select className="select w-32" value={params.universe}
        onChange={e => onChange('universe', e.target.value)}>
        {UNIVERSES.map(u => <option key={u}>{u}</option>)}
      </select>
      <select className="select w-28" value={params.delay}
        onChange={e => onChange('delay', e.target.value)}>
        <option value="0">Delay 0</option>
        <option value="1">Delay 1</option>
      </select>
      <button className="btn-primary" onClick={onSearch} disabled={loading}>
        {loading ? 'Loading…' : '🔍 Search'}
      </button>
    </div>
  )
}

export default function Datasets() {
  const navigate = useNavigate()
  const [params, setParams] = useState({ region: 'USA', universe: 'TOP3000', delay: '1', search: '' })
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)

  const change = useCallback((key, val) => setParams(p => ({ ...p, [key]: val })), [])

  async function search() {
    setLoading(true)
    setError(null)
    const qs = new URLSearchParams(params).toString()
    const res = await fetch(`/api/datasets?${qs}`, { credentials: 'include' })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) { setError(data.error); return }
    setResults(data)
  }

  function goFields(datasetId) {
    navigate(`/fields?dataset_id=${datasetId}&region=${params.region}&universe=${params.universe}&delay=${params.delay}`)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-fg">🗂 Datasets</h1>
        {results && (
          <span className="badge bg-canvas border border-border text-fg-muted">
            {results.length} dataset{results.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      <FilterBar params={params} onChange={change} onSearch={search} loading={loading} />

      {error && (
        <div className="p-3 rounded-md bg-red-900/20 border border-danger/40 text-sm text-danger">{error}</div>
      )}

      {results === null && !loading && (
        <div className="flex flex-col items-center justify-center py-20 text-fg-subtle">
          <span className="text-4xl mb-3">🗂</span>
          <p>Set your filters and click Search to discover datasets.</p>
        </div>
      )}

      {results && results.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-fg-subtle">
          <p>No datasets found for the selected filters.</p>
        </div>
      )}

      {results && results.length > 0 && (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead className="bg-canvas border-b border-border">
              <tr>
                <th className="th">Dataset ID</th>
                <th className="th">Name</th>
                <th className="th">Category</th>
                <th className="th">Fields</th>
                <th className="th"></th>
              </tr>
            </thead>
            <tbody>
              {results.map(ds => (
                <tr key={ds.id} className="table-row">
                  <td className="td"><code className="text-accent text-xs">{ds.id}</code></td>
                  <td className="td text-fg">{ds.name || '—'}</td>
                  <td className="td">
                    {ds.category
                      ? <span className="badge bg-canvas border border-border text-fg-muted">{ds.category}</span>
                      : <span className="text-fg-subtle">—</span>}
                  </td>
                  <td className="td text-fg-muted">{ds.fieldCount ?? '—'}</td>
                  <td className="td text-right">
                    <button
                      className="btn-ghost text-xs"
                      onClick={() => goFields(ds.id)}
                    >
                      Browse fields →
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
