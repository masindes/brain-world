import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'

function StatusBadge({ configured, label, email }) {
  return (
    <div className={`flex items-center justify-between p-4 rounded-lg border ${
      configured ? 'border-success/30 bg-green-900/10' : 'border-border bg-canvas-subtle'
    }`}>
      <div className="flex items-center gap-3">
        <span className="text-xl">{configured ? '✓' : '○'}</span>
        <div>
          <p className={`text-sm font-medium ${configured ? 'text-success' : 'text-fg-muted'}`}>
            {configured ? label + ' saved' : 'Not configured'}
          </p>
          {configured && email && <p className="text-xs text-fg-muted mt-0.5">{email}</p>}
        </div>
      </div>
    </div>
  )
}

export default function Setup() {
  // WQ BRAIN credentials
  const [wqEmail, setWqEmail]       = useState('')
  const [wqPassword, setWqPassword] = useState('')
  const [wqLoading, setWqLoading]   = useState(false)
  const [wqStatus, setWqStatus]     = useState(null)
  const [wqCurrent, setWqCurrent]   = useState(null)
  const [wqDeleting, setWqDeleting] = useState(false)

  // Alpha Vantage API key
  const [avKey, setAvKey]         = useState('')
  const [avLoading, setAvLoading] = useState(false)
  const [avStatus, setAvStatus]   = useState(null)
  const [avConfigured, setAvConf] = useState(null)
  const [avDeleting, setAvDel]    = useState(false)

  useEffect(() => {
    fetch('/api/wq-credentials', { credentials: 'include' }).then(r => r.json()).then(setWqCurrent)
    fetch('/api/market/av-key',  { credentials: 'include' }).then(r => r.json()).then(d => setAvConf(d.configured))
  }, [])

  // ---------- WQ BRAIN ----------
  async function handleWqSave(e) {
    e.preventDefault()
    setWqLoading(true); setWqStatus(null)
    const res  = await fetch('/api/wq-credentials', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: wqEmail, password: wqPassword }),
    })
    const data = await res.json()
    setWqLoading(false)
    if (data.ok) { setWqCurrent({ configured: true, email: wqEmail }); setWqPassword(''); setWqStatus({ ok: true }) }
    else          { setWqStatus({ error: data.error }) }
  }

  async function handleWqDelete() {
    if (!confirm('Remove WQ BRAIN credentials?')) return
    setWqDeleting(true)
    await fetch('/api/wq-credentials', { method: 'DELETE', credentials: 'include' })
    setWqCurrent({ configured: false, email: '' }); setWqEmail(''); setWqPassword(''); setWqStatus(null); setWqDeleting(false)
  }

  // ---------- Alpha Vantage ----------
  async function handleAvSave(e) {
    e.preventDefault()
    setAvLoading(true); setAvStatus(null)
    const res  = await fetch('/api/market/av-key', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: avKey }),
    })
    const data = await res.json()
    setAvLoading(false)
    if (data.ok) { setAvConf(true); setAvKey(''); setAvStatus({ ok: true }) }
    else          { setAvStatus({ error: data.error }) }
  }

  async function handleAvDelete() {
    setAvDel(true)
    await fetch('/api/market/av-key', { method: 'DELETE', credentials: 'include' })
    setAvConf(false); setAvKey(''); setAvStatus(null); setAvDel(false)
  }

  return (
    <div className="max-w-xl space-y-8">
      <div>
        <h1 className="text-xl font-bold text-fg">Setup</h1>
        <p className="text-sm text-fg-muted mt-1">Configure external credentials for this app.</p>
      </div>

      {/* ── Section 1: WQ BRAIN ── */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold text-fg border-b border-border pb-2">WQ BRAIN Account</h2>
        <p className="text-xs text-fg-muted">Used for Datasets, Fields, and Simulate.</p>

        {wqCurrent && <StatusBadge configured={wqCurrent.configured} label="Credentials" email={wqCurrent.email} />}

        {wqStatus?.ok    && <div className="p-3 rounded-lg border border-success/30 bg-green-900/10 text-success text-sm">✓ Saved successfully.</div>}
        {wqStatus?.error && <div className="p-3 rounded-lg border border-danger/40 bg-red-900/10 text-danger text-sm">⚠ {wqStatus.error}</div>}

        <div className="card p-5">
          <form onSubmit={handleWqSave} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-fg-muted mb-1">Email</label>
              <input type="email" className="input" placeholder="your_wq@example.com" value={wqEmail} onChange={e => setWqEmail(e.target.value)} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-fg-muted mb-1">Password</label>
              <input type="password" className="input" placeholder="WQ BRAIN password" value={wqPassword} onChange={e => setWqPassword(e.target.value)} required />
            </div>
            <div className="flex gap-2 pt-1">
              <button type="submit" disabled={wqLoading} className="btn-primary flex-1 justify-center">
                {wqLoading ? 'Saving…' : wqCurrent?.configured ? 'Update' : 'Save'}
              </button>
              {wqCurrent?.configured && (
                <button type="button" onClick={handleWqDelete} disabled={wqDeleting} className="btn-ghost text-danger/80 hover:text-danger border-danger/20">
                  {wqDeleting ? '…' : 'Remove'}
                </button>
              )}
            </div>
          </form>
        </div>
      </section>

      {/* ── Section 2: Alpha Vantage ── */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold text-fg border-b border-border pb-2">Alpha Vantage API Key</h2>
        <p className="text-xs text-fg-muted">
          Used for Market Data (stocks, ETFs, indices). Free key at{' '}
          <a href="https://www.alphavantage.co/support/#api-key" target="_blank" rel="noreferrer" className="text-accent hover:underline">
            alphavantage.co ↗
          </a>{' '}
          — takes under 20 seconds, gives 25 requests/day.
        </p>

        {avConfigured !== null && <StatusBadge configured={avConfigured} label="API key" />}

        {avStatus?.ok    && <div className="p-3 rounded-lg border border-success/30 bg-green-900/10 text-success text-sm">✓ Key verified and saved.</div>}
        {avStatus?.error && <div className="p-3 rounded-lg border border-danger/40 bg-red-900/10 text-danger text-sm">⚠ {avStatus.error}</div>}

        <div className="card p-5">
          <form onSubmit={handleAvSave} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-fg-muted mb-1">API Key</label>
              <input
                type="text"
                className="input font-mono"
                placeholder="Paste your Alpha Vantage key here"
                value={avKey}
                onChange={e => setAvKey(e.target.value)}
                required
              />
            </div>
            <div className="flex gap-2 pt-1">
              <button type="submit" disabled={avLoading} className="btn-primary flex-1 justify-center">
                {avLoading ? 'Verifying…' : avConfigured ? 'Update key' : 'Save key'}
              </button>
              {avConfigured && (
                <button type="button" onClick={handleAvDelete} disabled={avDeleting} className="btn-ghost text-danger/80 hover:text-danger border-danger/20">
                  {avDeleting ? '…' : 'Remove'}
                </button>
              )}
            </div>
          </form>
        </div>
      </section>

      <div className="p-4 rounded-lg border border-border bg-canvas-subtle text-xs text-fg-muted space-y-1.5">
        <p className="font-medium text-fg-muted">Storage</p>
        <p>WQ credentials → <code className="text-accent">credentials.json</code></p>
        <p>Alpha Vantage key → <code className="text-accent">av_key.txt</code></p>
        <p>Both files are local to this server only.</p>
      </div>

      <Link to="/" className="btn-ghost text-sm inline-flex">← Back to Dashboard</Link>
    </div>
  )
}
