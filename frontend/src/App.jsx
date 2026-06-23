import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect, createContext, useContext } from 'react'
import Login     from './pages/Login'
import Dashboard from './pages/Dashboard'
import Datasets  from './pages/Datasets'
import Fields    from './pages/Fields'
import Simulate  from './pages/Simulate'
import Setup     from './pages/Setup'
import Layout    from './pages/Layout'

export const AuthCtx = createContext(null)

export function useAuth() { return useContext(AuthCtx) }

function RequireAuth({ children }) {
  const { user, loading } = useAuth()
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-canvas">
      <span className="inline-block w-6 h-6 border-2 border-border border-t-accent rounded-full animate-spin" />
    </div>
  )
  return user ? children : <Navigate to="/login" replace />
}

export default function App() {
  const [user, setUser]       = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/me', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(data => { setUser(data?.email ?? null); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  return (
    <AuthCtx.Provider value={{ user, setUser, loading }}>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<RequireAuth><Layout /></RequireAuth>}>
            <Route index             element={<Dashboard />} />
            <Route path="datasets"   element={<Datasets />} />
            <Route path="fields"     element={<Fields />} />
            <Route path="simulate"   element={<Simulate />} />
            <Route path="setup"      element={<Setup />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthCtx.Provider>
  )
}
