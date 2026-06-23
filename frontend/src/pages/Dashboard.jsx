import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../App'

function StatCard({ label, value, sub, accent }) {
  return (
    <div className="card p-5">
      <p className="text-xs text-fg-muted uppercase tracking-wider mb-2">{label}</p>
      <p className={`text-3xl font-bold ${accent ? 'text-accent' : 'text-fg'}`}>{value}</p>
      {sub && <p className="text-xs text-fg-subtle mt-1">{sub}</p>}
    </div>
  )
}

function HistoryRow({ run, onRerun }) {
  const date = new Date(run.timestamp * 1000)
  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const dateStr = date.toLocaleDateString([], { month: 'short', day: 'numeric' })
  const passed  = run.passed_checks === run.total_checks

  return (
    <tr className="table-row">
      <td className="td">
        <code className="text-xs text-accent break-all">{run.expression}</code>
      </td>
      <td className="td text-fg-muted text-xs whitespace-nowrap">{run.region}</td>
      <td className="td">
        <span className={`text-sm font-medium ${
          run.sharpe >= 1.25 ? 'text-success' : run.sharpe < 0 ? 'text-danger' : 'text-fg'
        }`}>
          {run.sharpe != null ? run.sharpe.toFixed(3) : '—'}
        </span>
      </td>
      <td className="td">
        <span className={`badge text-xs ${
          passed
            ? 'bg-green-900/40 text-success border border-success/30'
            : 'bg-red-900/30 text-danger border border-danger/30'
        }`}>
          {run.passed_checks}/{run.total_checks}
        </span>
      </td>
      <td className="td text-fg-subtle text-xs whitespace-nowrap">{dateStr} {timeStr}</td>
      <td className="td text-right">
        <button className="btn-ghost text-xs" onClick={() => onRerun(run.expression)}>
          ▶ Rerun
        </button>
      </td>
    </tr>
  )
}

export default function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [wq, setWq]         = useState(null)
  const [history, setHistory] = useState([])
  const [histLoading, setHistLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/wq-credentials', { credentials: 'include' }).then(r => r.json()),
      fetch('/api/history', { credentials: 'include' }).then(r => r.json()),
    ]).then(([wqData, histData]) => {
      setWq(wqData)
      setHistory(Array.isArray(histData) ? histData : [])
      setHistLoading(false)
    }).catch(() => setHistLoading(false))
  }, [])

  function rerun(expression) {
    navigate(`/simulate?expression=${encodeURIComponent(expression)}`)
  }

  async function clearHistory() {
    await fetch('/api/history', { method: 'DELETE', credentials: 'include' })
    setHistory([])
  }

  const bestSharpe = history.reduce((best, r) => {
    if (r.sharpe != null && r.sharpe > best) return r.sharpe
    return best
  }, -Infinity)

  const passed = history.filter(r => r.passed_checks === r.total_checks).length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-fg">Dashboard</h1>
        <p className="text-sm text-fg-muted mt-0.5">Welcome back, {user}</p>
      </div>

      {/* WQ Credentials status banner */}
      {wq && !wq.configured && (
        <div className="flex items-center justify-between p-4 rounded-lg border border-warning/40 bg-yellow-900/10">
          <div className="flex items-center gap-3">
            <span className="text-xl">⚠</span>
            <div>
              <p className="text-sm font-medium text-warning">WQ BRAIN credentials not configured</p>
              <p className="text-xs text-fg-muted mt-0.5">Add your WorldQuant BRAIN account credentials to use Datasets, Fields, and Simulate.</p>
            </div>
          </div>
          <Link to="/setup" className="btn-primary text-xs whitespace-nowrap">Configure →</Link>
        </div>
      )}

      {wq && wq.configured && (
        <div className="flex items-center justify-between p-4 rounded-lg border border-success/30 bg-green-900/10">
          <div className="flex items-center gap-3">
            <span className="text-xl">✓</span>
            <div>
              <p className="text-sm font-medium text-success">Connected to WQ BRAIN</p>
              <p className="text-xs text-fg-muted mt-0.5">{wq.email}</p>
            </div>
          </div>
          <Link to="/setup" className="btn-ghost text-xs">Manage →</Link>
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Simulations run" value={history.length} sub="this session" />
        <StatCard
          label="Best Sharpe"
          value={history.length ? (isFinite(bestSharpe) ? bestSharpe.toFixed(3) : '—') : '—'}
          sub="highest in session"
          accent={isFinite(bestSharpe) && bestSharpe >= 1.25}
        />
        <StatCard label="All checks passed" value={passed} sub="of all simulations" />
        <StatCard
          label="Pass rate"
          value={history.length ? `${Math.round(passed / history.length * 100)}%` : '—'}
          sub="simulations fully passed"
        />
      </div>

      {/* Quick actions */}
      <div>
        <h2 className="text-sm font-semibold text-fg-muted uppercase tracking-wider mb-3">Quick actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Link to="/datasets" className="card p-4 hover:border-accent/50 transition-colors group">
            <div className="text-2xl mb-2">🗂</div>
            <p className="font-medium text-fg group-hover:text-accent transition-colors">Browse Datasets</p>
            <p className="text-xs text-fg-muted mt-1">Explore available data sources by region & universe</p>
          </Link>
          <Link to="/fields" className="card p-4 hover:border-accent/50 transition-colors group">
            <div className="text-2xl mb-2">🔍</div>
            <p className="font-medium text-fg group-hover:text-accent transition-colors">Search Fields</p>
            <p className="text-xs text-fg-muted mt-1">Discover data fields within a dataset</p>
          </Link>
          <Link to="/simulate" className="card p-4 hover:border-accent/50 transition-colors group">
            <div className="text-2xl mb-2">▶</div>
            <p className="font-medium text-fg group-hover:text-accent transition-colors">Simulate Alpha</p>
            <p className="text-xs text-fg-muted mt-1">Submit and test an alpha expression</p>
          </Link>
        </div>
      </div>

      {/* Simulation history */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-fg-muted uppercase tracking-wider">Recent simulations</h2>
          {history.length > 0 && (
            <button onClick={clearHistory} className="btn-ghost text-xs text-danger/80 hover:text-danger border-danger/20">
              Clear history
            </button>
          )}
        </div>

        {histLoading && (
          <div className="card p-8 flex justify-center">
            <span className="inline-block w-5 h-5 border-2 border-border border-t-accent rounded-full animate-spin" />
          </div>
        )}

        {!histLoading && history.length === 0 && (
          <div className="card p-10 flex flex-col items-center text-fg-subtle">
            <span className="text-3xl mb-3">📭</span>
            <p className="text-sm">No simulations yet. Run your first alpha in the Simulate tab.</p>
            <Link to="/simulate" className="btn-primary mt-4 text-sm">Go to Simulate →</Link>
          </div>
        )}

        {!histLoading && history.length > 0 && (
          <div className="card overflow-hidden">
            <table className="w-full">
              <thead className="bg-canvas border-b border-border">
                <tr>
                  <th className="th">Expression</th>
                  <th className="th">Region</th>
                  <th className="th">Sharpe</th>
                  <th className="th">Checks</th>
                  <th className="th">Time</th>
                  <th className="th"></th>
                </tr>
              </thead>
              <tbody>
                {history.map(run => (
                  <HistoryRow key={run.id} run={run} onRerun={rerun} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
