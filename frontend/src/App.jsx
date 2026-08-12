import React, { useState, useEffect } from 'react'
import Dashboard    from './pages/Dashboard'
import Transactions from './pages/Transactions'
import Predict      from './pages/Predict'
import Alerts       from './pages/Alerts'
import Settings     from './pages/Settings'
import Login        from './pages/Login'
import { StatusDot, Badge } from './components'
import { health, auth, fetchMe } from './api'

const NAV = [
  { id: 'dashboard',    label: 'Dashboard',     icon: '▦' },
  { id: 'transactions', label: 'Transactions',  icon: '⇄' },
  { id: 'predict',      label: 'Predict',       icon: '◎' },
  { id: 'alerts',       label: 'Alerts',        icon: '⚑' },
  { id: 'settings',     label: 'Settings',      icon: '⚙', adminOnly: true },
]

const PAGE_MAP = {
  dashboard: Dashboard, transactions: Transactions,
  predict: Predict, alerts: Alerts, settings: Settings,
}

export default function App() {
  const [page,    setPage]    = useState('dashboard')
  const [apiOk,   setApiOk]   = useState(null)
  const [user,    setUser]     = useState(() => auth.getUser())
  const [loading, setLoading]  = useState(true)

  // Re-validate token on mount
  useEffect(() => {
    const token = auth.getToken()
    if (token) {
      fetchMe()
        .then(u => { auth.setSession(token, u); setUser(u) })
        .catch(() => { auth.clear(); setUser(null) })
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  // API health check
  useEffect(() => {
    health().then(() => setApiOk(true)).catch(() => setApiOk(false))
  }, [])

  // Auto-logout on 401 from any request
  useEffect(() => {
    const handler = () => setUser(null)
    window.addEventListener('fraudnet:logout', handler)
    return () => window.removeEventListener('fraudnet:logout', handler)
  }, [])

  const handleLogin  = (u) => setUser(u)
  const handleLogout = ()  => { auth.clear(); setUser(null) }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg)' }}>
        <div style={{ width: 28, height: 28, borderRadius: '50%', border: '2px solid var(--border)', borderTopColor: 'var(--accent)', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  if (!user) return <Login onLogin={handleLogin} />

  const visibleNav = NAV.filter(n => !n.adminOnly || user.role === 'admin')
  const Page = PAGE_MAP[page] || Dashboard

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* Sidebar */}
      <aside style={{
        width: 200, background: 'var(--surface)', borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', flexShrink: 0,
      }}>
        {/* Logo */}
        <div style={{ padding: '18px 16px 16px', borderBottom: '1px solid var(--border)' }}>
          <div style={{
            width: 34, height: 34, background: 'var(--accent)', borderRadius: 7,
            display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10,
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0a0e1a" strokeWidth="2.5" strokeLinecap="round">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
            </svg>
          </div>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>FraudNet</div>
          <div style={{ fontSize: 9, color: 'var(--muted)' }}>v3.0 · XGBoost + SHAP</div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '8px 0' }}>
          {visibleNav.map(({ id, label, icon }) => (
            <button key={id} onClick={() => setPage(id)} style={{
              width: '100%', padding: '9px 16px', display: 'flex', alignItems: 'center', gap: 10,
              background: page === id ? 'rgba(0,212,255,0.07)' : 'transparent',
              border: 'none', borderLeft: `2px solid ${page === id ? 'var(--accent)' : 'transparent'}`,
              color: page === id ? 'var(--accent)' : 'var(--muted)',
              fontSize: 11, fontFamily: 'var(--font-mono)', letterSpacing: '0.04em',
              textAlign: 'left', cursor: 'pointer', transition: 'all 0.15s',
            }}
            onMouseEnter={e => { if (page !== id) { e.currentTarget.style.color='var(--text)'; e.currentTarget.style.background='rgba(255,255,255,0.02)' }}}
            onMouseLeave={e => { if (page !== id) { e.currentTarget.style.color='var(--muted)'; e.currentTarget.style.background='transparent' }}}
            >
              <span style={{ fontSize: 13, flexShrink: 0 }}>{icon}</span>
              <span style={{ flex: 1 }}>{label}</span>
            </button>
          ))}
        </nav>

        {/* User + Status */}
        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
          {/* User pill */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text)' }}>{user.username}</div>
              <div style={{ fontSize: 9, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{user.role}</div>
            </div>
            <button onClick={handleLogout} title="Logout" style={{
              background: 'rgba(255,69,96,0.08)', border: '1px solid rgba(255,69,96,0.25)',
              borderRadius: 4, padding: '3px 8px', fontSize: 9, color: 'var(--danger)',
              cursor: 'pointer', fontFamily: 'var(--font-mono)',
            }}>OUT</button>
          </div>
          <div style={{ fontSize: 10, color: 'var(--muted)' }}>
            <StatusDot color={apiOk ? 'var(--ok)' : 'var(--warn)'} />
            {apiOk === null ? 'CONNECTING...' : apiOk ? 'API ONLINE' : 'DEMO MODE'}
          </div>
        </div>
      </aside>

      {/* Main area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Topbar */}
        <header style={{
          padding: '12px 24px', background: 'var(--surface)', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          position: 'sticky', top: 0, zIndex: 10, flexShrink: 0,
        }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', letterSpacing: '0.04em' }}>
              {visibleNav.find(n => n.id === page)?.label}
            </div>
            <div style={{ fontSize: 10, color: 'var(--muted)' }}>
              Credit Card Fraud Detection · Kaggle Dataset
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <Badge color="var(--accent)">XGBoost + SHAP</Badge>
            <Badge color={apiOk ? 'var(--ok)' : 'var(--warn)'}>{apiOk ? 'API LIVE' : 'DEMO'}</Badge>
          </div>
        </header>

        <main style={{ flex: 1, overflow: 'auto', padding: 20 }}>
          <Page user={user} />
        </main>
      </div>
    </div>
  )
}
