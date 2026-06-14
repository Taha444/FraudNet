import React, { useState, useEffect } from 'react'
import Dashboard from './pages/Dashboard'
import Transactions from './pages/Transactions'
import Predict from './pages/Predict'
import Alerts from './pages/Alerts'
import { StatusDot, Badge } from './components'
import { health } from './api'

const NAV = [
  { id: 'dashboard',    label: 'Dashboard',     icon: '▦' },
  { id: 'transactions', label: 'Transactions',  icon: '⇄' },
  { id: 'predict',      label: 'Predict',       icon: '◎' },
  { id: 'alerts',       label: 'Alerts',        icon: '⚑', badge: 3 },
]

export default function App() {
  const [page, setPage] = useState('dashboard')
  const [apiOk, setApiOk] = useState(null)

  useEffect(() => {
    health()
      .then(() => setApiOk(true))
      .catch(() => setApiOk(false))
  }, [])

  const PAGE_MAP = { dashboard: Dashboard, transactions: Transactions, predict: Predict, alerts: Alerts }
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
          <div style={{ fontSize: 9, color: 'var(--muted)' }}>v2.3 · IEEE / Kaggle</div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '8px 0' }}>
          {NAV.map(({ id, label, icon, badge }) => (
            <button key={id} onClick={() => setPage(id)} style={{
              width: '100%', padding: '9px 16px', display: 'flex', alignItems: 'center', gap: 10,
              background: page === id ? 'rgba(0,212,255,0.07)' : 'transparent',
              border: 'none', borderLeft: `2px solid ${page === id ? 'var(--accent)' : 'transparent'}`,
              color: page === id ? 'var(--accent)' : 'var(--muted)',
              fontSize: 11, fontFamily: 'var(--font-mono)', letterSpacing: '0.04em',
              textAlign: 'left', cursor: 'pointer', transition: 'all 0.15s',
            }}
            onMouseEnter={e => { if (page !== id) { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.background = 'rgba(255,255,255,0.02)' } }}
            onMouseLeave={e => { if (page !== id) { e.currentTarget.style.color = 'var(--muted)'; e.currentTarget.style.background = 'transparent' } }}
            >
              <span style={{ fontSize: 13, flexShrink: 0 }}>{icon}</span>
              <span style={{ flex: 1 }}>{label}</span>
              {badge && <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 10, background: 'rgba(255,69,96,0.2)', color: 'var(--danger)', border: '1px solid rgba(255,69,96,0.35)' }}>{badge}</span>}
            </button>
          ))}
        </nav>

        {/* Status */}
        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
          <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 4 }}>
            <StatusDot color={apiOk ? 'var(--ok)' : 'var(--warn)'} />
            {apiOk === null ? 'CONNECTING...' : apiOk ? 'API ONLINE' : 'DEMO MODE'}
          </div>
          <div style={{ fontSize: 9, color: 'var(--muted)' }}>284,807 tx · XGBoost</div>
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
              {NAV.find(n => n.id === page)?.label}
            </div>
            <div style={{ fontSize: 10, color: 'var(--muted)' }}>
              Credit Card Fraud Detection · Kaggle Dataset
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <Badge color="var(--accent)">XGBoost + IsoForest</Badge>
            <Badge color={apiOk ? 'var(--ok)' : 'var(--warn)'}>{apiOk ? 'API LIVE' : 'DEMO'}</Badge>
          </div>
        </header>

        {/* Page content */}
        <main style={{ flex: 1, overflow: 'auto', padding: 20 }}>
          <Page />
        </main>
      </div>
    </div>
  )
}
