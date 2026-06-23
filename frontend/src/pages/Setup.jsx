import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'

export default function Setup() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [status, setStatus]     = useState(null)   // { ok, error, biometric_url }
  const [current, setCurrent]   = useState(null)   // existing wq credentials status
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    fetch('/api/wq-credentials', { credentials: 'include' })
      .then(r => r.json())
      .then(setCurrent)
  }, [])

  async function handleSave(e) {
    e.preventDefault()
    setLoading(true)
    setStatus(null)

    const res = await fetch('/api/wq-credentials', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const data = await res.json()
    setLoading(false)

    if (data.ok) {
      setCurrent({ configured: true, email })
      setPassword('')
      setStatus({ ok: true, biometric_url: data.biometric_url || null })
    } else {
      setStatus({ error: data.error })
    }
  }

  async function handleDelete() {
    if (!confirm('Remove WQ BRAIN credentials from this server?')) return
    setDeleting(true)
    await fetch('/api/wq-credentials', { method: 'DELETE', credentials: 'include' })
    setCurrent({ configured: false, email: '' })
    setEmail('')
    setPassword('')
    setStatus(null)
    setDeleting(false)
  }

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-fg">WQ BRAIN Credentials</h1>
        <p className="text-sm text-fg-muted mt-1">
          Configure your WorldQuant BRAIN account so the app can fetch datasets, fields, and run simulations.
        </p>
      </div>

      {/* Current status */}
      {current && (
        <div className={`flex items-center justify-between p-4 rounded-lg border ${
          current.configured
            ? 'border-success/30 bg-green-900/10'
            : 'border-border bg-canvas-subtle'
        }`}>
          <div className="flex items-center gap-3">
            <span className="text-xl">{current.configured ? '✓' : '○'}</span>
            <div>
              <p className={`text-sm font-medium ${current.configured ? 'text-success' : 'text-fg-muted'}`}>
                {current.configured ? 'Credentials saved' : 'Not configured'}
              </p>
              {current.configured && (
                <p className="text-xs text-fg-muted mt-0.5">{current.email}</p>
              )}
            </div>
          </div>
          {current.configured && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="btn-ghost text-xs text-danger/80 hover:text-danger border-danger/20"
            >
              {deleting ? 'Removing…' : 'Remove'}
            </button>
          )}
        </div>
      )}

      {/* Status messages */}
      {status?.ok && (
        <div className="p-4 rounded-lg border border-success/30 bg-green-900/10 text-success text-sm">
          <p className="font-medium">✓ Credentials saved successfully!</p>
          {status.biometric_url && (
            <div className="mt-2 space-y-2">
              <p className="text-warning text-xs">Biometric verification required by WQ BRAIN.</p>
              <a
                href={status.biometric_url}
                target="_blank"
                rel="noreferrer"
                className="inline-block text-xs text-accent hover:underline"
              >
                Complete verification ↗
              </a>
            </div>
          )}
        </div>
      )}
      {status?.error && (
        <div className="p-4 rounded-lg border border-danger/40 bg-red-900/10 text-danger text-sm">
          ⚠ {status.error}
        </div>
      )}

      {/* Form */}
      <div className="card p-6">
        <h2 className="text-sm font-semibold text-fg mb-4">
          {current?.configured ? 'Update credentials' : 'Add credentials'}
        </h2>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-fg-muted mb-1.5">
              WQ BRAIN Email
            </label>
            <input
              type="email"
              className="input"
              placeholder="your_wq_email@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-fg-muted mb-1.5">
              WQ BRAIN Password
            </label>
            <input
              type="password"
              className="input"
              placeholder="Your WQ BRAIN password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>

          <div className="pt-1">
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full justify-center py-2.5"
            >
              {loading
                ? <span className="flex items-center gap-2 justify-center">
                    <span className="inline-block w-4 h-4 border-2 border-canvas/40 border-t-canvas rounded-full animate-spin" />
                    Verifying with WQ BRAIN…
                  </span>
                : current?.configured ? 'Update credentials' : 'Save credentials'}
            </button>
          </div>
        </form>
      </div>

      {/* Info box */}
      <div className="p-4 rounded-lg border border-border bg-canvas-subtle text-xs text-fg-muted space-y-2">
        <p className="font-medium text-fg-muted">About credential storage</p>
        <p>Your WQ BRAIN credentials are saved in a <code className="text-accent">credentials.json</code> file on this server. They are never sent anywhere except to <code className="text-accent">api.worldquantbrain.com</code>.</p>
        <p>This is a local tool — keep the server accessible only to yourself.</p>
      </div>

      <div className="flex items-center gap-3">
        <Link to="/" className="btn-ghost text-sm">← Back to Dashboard</Link>
      </div>
    </div>
  )
}
