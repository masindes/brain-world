import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../App'

export default function Login() {
  const { setUser } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail]       = useState('watty.s@outlook.com')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const res = await fetch('/api/login', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const data = await res.json()
    setLoading(false)

    if (data.ok) {
      setUser(email)
      navigate('/')
    } else {
      setError(data.error || 'Login failed.')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-canvas">
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-accent/10 border border-accent/20 mb-4">
            <span className="text-2xl">🧠</span>
          </div>
          <h1 className="text-2xl font-bold text-fg tracking-tight">WQ Brain</h1>
          <p className="text-sm text-fg-muted mt-1">WorldQuant BRAIN Explorer</p>
        </div>

        <div className="card p-8">
          {error && (
            <div className="mb-5 p-3 rounded-md bg-red-900/30 border border-danger/40 text-sm text-danger flex items-center gap-2">
              <span>⚠</span> {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-fg-muted mb-1.5">Email</label>
              <input
                type="email"
                className="input"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-fg-muted mb-1.5">Password</label>
              <input
                type="password"
                className="input"
                placeholder="Enter your password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full justify-center mt-2 py-2.5"
            >
              {loading
                ? <span className="flex items-center gap-2 justify-center">
                    <span className="inline-block w-4 h-4 border-2 border-canvas/40 border-t-canvas rounded-full animate-spin" />
                    Signing in…
                  </span>
                : 'Sign in'}
            </button>
          </form>
        </div>

        <p className="mt-4 text-xs text-fg-subtle text-center">
          Credentials are stored only in your browser session.
        </p>
      </div>
    </div>
  )
}
