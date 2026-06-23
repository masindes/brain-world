import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect, createContext, useContext } from 'react'
import Login    from './pages/Login'
import Datasets from './pages/Datasets'
import Fields   from './pages/Fields'
import Simulate from './pages/Simulate'
import Layout   from './pages/Layout'

export const AuthCtx = createContext(null)

export function useAuth() { return useContext(AuthCtx) }

function RequireAuth({ children }) {
  const { user, loading } = useAuth()
  if (loading) return null
  return user ? children : <Navigate to="/login" replace />
}

export default function App() {
  const [user, setUser]     = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/me', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(data => { setUser(data?.email ?? null); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  return (
    <AuthCtx.Provider value={{ user, setUser, loading }}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<RequireAuth><Layout /></RequireAuth>}>
            <Route index          element={<Navigate to="/datasets" replace />} />
            <Route path="datasets" element={<Datasets />} />
            <Route path="fields"   element={<Fields />} />
            <Route path="simulate" element={<Simulate />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthCtx.Provider>
  )
}
