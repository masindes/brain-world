import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { useAuth } from '../App'

const navItems = [
  { to: '/',         label: 'Dashboard', icon: '⊞', exact: true },
  { to: '/datasets', label: 'Datasets',  icon: '🗂' },
  { to: '/fields',   label: 'Fields',    icon: '🔍' },
  { to: '/simulate', label: 'Simulate',  icon: '▶'  },
]

export default function Layout() {
  const { user, setUser } = useAuth()
  const navigate = useNavigate()
  const [wqOk, setWqOk] = useState(null)

  useEffect(() => {
    if (!user) return
    fetch('/api/wq-credentials', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(d => setWqOk(d?.configured ?? false))
      .catch(() => setWqOk(false))
  }, [user])

  async function handleLogout() {
    await fetch('/api/logout', { method: 'POST', credentials: 'include' })
    setUser(null)
    navigate('/login')
  }

  return (
    <div className="flex h-full min-h-screen">
      {/* Sidebar */}
      <aside className="w-52 shrink-0 bg-canvas-subtle border-r border-border flex flex-col">
        <div className="px-4 py-5 border-b border-border flex items-center gap-2.5">
          <span className="text-lg">🧠</span>
          <span className="text-accent font-bold text-base tracking-tight">WQ Brain</span>
        </div>

        <nav className="flex-1 py-3 space-y-0.5 px-2">
          {navItems.map(({ to, label, icon, exact }) => (
            <NavLink
              key={to}
              to={to}
              end={exact}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors
                 ${isActive
                   ? 'bg-accent/10 text-accent'
                   : 'text-fg-muted hover:text-fg hover:bg-canvas'}`
              }
            >
              <span className="text-base w-5 text-center">{icon}</span>
              {label}
            </NavLink>
          ))}

          <NavLink
            to="/setup"
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors
               ${isActive
                 ? 'bg-accent/10 text-accent'
                 : 'text-fg-muted hover:text-fg hover:bg-canvas'}`
            }
          >
            <span className="text-base w-5 text-center">⚙</span>
            <span className="flex-1">WQ Setup</span>
            {wqOk === true  && <span className="w-2 h-2 rounded-full bg-success shrink-0" title="Connected" />}
            {wqOk === false && <span className="w-2 h-2 rounded-full bg-warning shrink-0" title="Not configured" />}
          </NavLink>
        </nav>

        <div className="px-4 py-3 border-t border-border">
          <p className="text-xs text-fg-subtle truncate mb-2" title={user}>{user}</p>
          <button onClick={handleLogout} className="btn-ghost w-full justify-center text-xs">
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto p-6 bg-canvas">
        <Outlet />
      </main>
    </div>
  )
}
