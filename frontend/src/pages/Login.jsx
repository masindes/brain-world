import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../App'

export default function Login() {
  const { setUser } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState(null)
  const [biometric, setBiometric] = useState(null)

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
      navigate('/datasets')
    } else if (data.biometric_required) {
      setBiometric(data.biometric_url)
    } else {
      setError(data.error || 'Login failed.')
    }
  }

  async function handleVerify() {
    setLoading(true)
    setError(null)
    const res = await fetch('/api/login/verify', {
      method: 'POST',
      credentials: 'include',
    })
    const data = await res.json()
    setLoading(false)
    if (data.ok) {
      setUser(email)
      navigate('/datasets')
    } else {
      setError(data.error || 'Verification failed.')
      setBiometric(null)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-canvas">
      <div className="w-full max-w-sm">
        <div className="card p-8">
          <h1 className="text-xl font-semibold text-fg mb-1">WorldQuant BRAIN</h1>
          <p className="text-sm text-fg-muted mb-6">Sign in with your BRAIN account.</p>

          {error && (
            <div className="mb-4 p-3 rounded-md bg-red-900/30 border border-danger/40 text-sm text-danger">
              {error}
            </div>
          )}

          {biometric ? (
            <div className="space-y-4">
              <div className="p-3 rounded-md bg-yellow-900/20 border border-warning/40 text-sm text-warning">
                Biometric verification required. Complete it in your browser, then click Continue.
              </div>
              <a
                href={biometric}
                target="_blank"
                rel="noreferrer"
                className="btn-ghost w-full justify-center"
              >
                Open verification page ↗
              </a>
              <button
                onClick={handleVerify}
                disabled={loading}
                className="btn-primary w-full justify-center"
              >
                {loading ? 'Verifying…' : 'Continue after verification'}
              </button>
              <button onClick={() => setBiometric(null)} className="text-xs text-fg-subtle underline w-full text-center">
                Start over
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-fg-muted mb-1">Email</label>
                <input
                  type="email"
                  className="input"
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm text-fg-muted mb-1">Password</label>
                <input
                  type="password"
                  className="input"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full justify-center mt-2"
              >
                {loading ? 'Signing in…' : 'Sign in'}
              </button>
            </form>
          )}

          <p className="mt-5 text-xs text-fg-subtle text-center">
            Credentials are stored only in your browser session.
          </p>
        </div>
      </div>
    </div>
  )
}
