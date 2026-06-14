import React, { useState } from 'react'
import { Panel, RiskPill, Badge } from '../components'

const INITIAL_ALERTS = [
  { id: 'ALT-001', level: 'CRITICAL', tx: 'TX-28000', amount: 5000.00, score: 0.97, type: 'High-value wire', time: '2 min ago', features: ['V14', 'V17', 'HIGH_AMOUNT'], status: 'OPEN' },
  { id: 'ALT-002', level: 'CRITICAL', tx: 'TX-27998', amount: 2847.30, score: 0.94, type: 'Online purchase', time: '5 min ago', features: ['V12', 'V17'], status: 'OPEN' },
  { id: 'ALT-003', level: 'HIGH',     tx: 'TX-27995', amount: 1200.00, score: 0.88, type: 'ATM withdrawal', time: '8 min ago', features: ['V14'], status: 'REVIEW' },
  { id: 'ALT-004', level: 'HIGH',     tx: 'TX-27990', amount: 156.00,  score: 0.81, type: 'Mobile pay', time: '12 min ago', features: ['V10', 'V11'], status: 'OPEN' },
  { id: 'ALT-005', level: 'CRITICAL', tx: 'VELOCITY', amount: null,    score: null, type: 'Velocity alert — 6 txns in 3 min (card *4821)', time: '18 min ago', features: ['VELOCITY'], status: 'OPEN' },
  { id: 'ALT-006', level: 'HIGH',     tx: 'TX-27980', amount: 899.99,  score: 0.79, type: 'POS terminal', time: '24 min ago', features: ['V14', 'ODD_HOURS'], status: 'RESOLVED' },
  { id: 'ALT-007', level: 'MEDIUM',   tx: 'TX-27972', amount: 230.10,  score: 0.62, type: 'Online purchase', time: '31 min ago', features: ['V4'], status: 'RESOLVED' },
]

const LEVEL_COLORS = {
  CRITICAL: { bg: 'rgba(255,69,96,0.12)',  border: 'rgba(255,69,96,0.35)',  color: 'var(--danger)', dot: '#ff4560' },
  HIGH:     { bg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.3)',  color: 'var(--warn)',   dot: '#f59e0b' },
  MEDIUM:   { bg: 'rgba(0,212,255,0.07)',  border: 'rgba(0,212,255,0.2)',   color: 'var(--accent)', dot: '#00d4ff' },
}

const STATUS_COLORS = {
  OPEN:     { color: 'var(--danger)', bg: 'rgba(255,69,96,0.1)',   border: 'rgba(255,69,96,0.3)' },
  REVIEW:   { color: 'var(--warn)',   bg: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.3)' },
  RESOLVED: { color: 'var(--ok)',     bg: 'rgba(0,224,150,0.08)',  border: 'rgba(0,224,150,0.25)' },
}

export default function Alerts() {
  const [alerts, setAlerts] = useState(INITIAL_ALERTS)
  const [filter, setFilter] = useState('ALL')
  const [selected, setSelected] = useState(null)

  const resolve = id => {
    setAlerts(a => a.map(x => x.id === id ? { ...x, status: 'RESOLVED' } : x))
    if (selected?.id === id) setSelected(a => ({ ...a, status: 'RESOLVED' }))
  }

  const dismiss = id => {
    setAlerts(a => a.filter(x => x.id !== id))
    if (selected?.id === id) setSelected(null)
  }

  const open = alerts.filter(a => a.status === 'OPEN').length
  const critical = alerts.filter(a => a.level === 'CRITICAL' && a.status === 'OPEN').length

  const filtered = filter === 'ALL' ? alerts : alerts.filter(a =>
    filter === 'OPEN' ? a.status !== 'RESOLVED' : a.status === 'RESOLVED'
  )

  return (
    <div style={{ animation: 'fadeIn 0.4s ease' }}>
      {/* Summary bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 18 }}>
        {[
          { label: 'Open Alerts',    val: open,     color: 'var(--danger)', top: 'var(--danger)' },
          { label: 'Critical',       val: critical,  color: 'var(--danger)', top: 'var(--danger)' },
          { label: 'Under Review',   val: alerts.filter(a => a.status === 'REVIEW').length, color: 'var(--warn)', top: 'var(--warn)' },
          { label: 'Resolved Today', val: alerts.filter(a => a.status === 'RESOLVED').length, color: 'var(--ok)', top: 'var(--ok)' },
        ].map(({ label, val, color, top }) => (
          <div key={label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 16, position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: top }} />
            <div style={{ fontSize: 9, color: 'var(--muted)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>{label}</div>
            <div style={{ fontSize: 30, fontWeight: 600, color }}>{val}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 320px' : '1fr', gap: 14 }}>
        <Panel
          title="Alert Queue"
          sub={`${filtered.length} alerts`}
          headerRight={
            <div style={{ display: 'flex', gap: 6 }}>
              {['ALL', 'OPEN', 'RESOLVED'].map(f => (
                <button key={f} onClick={() => setFilter(f)} style={{
                  padding: '4px 12px', borderRadius: 4, fontSize: 9, fontFamily: 'var(--font-mono)',
                  border: `1px solid ${filter === f ? 'var(--accent)' : 'var(--border)'}`,
                  background: filter === f ? 'rgba(0,212,255,0.1)' : 'var(--surface2)',
                  color: filter === f ? 'var(--accent)' : 'var(--muted)', letterSpacing: '0.07em',
                }}>{f}</button>
              ))}
            </div>
          }
        >
          <div>
            {filtered.map(alert => {
              const lc = LEVEL_COLORS[alert.level] || LEVEL_COLORS.MEDIUM
              const sc = STATUS_COLORS[alert.status]
              return (
                <div key={alert.id}
                  onClick={() => setSelected(selected?.id === alert.id ? null : alert)}
                  style={{
                    padding: '12px 16px', borderBottom: '1px solid var(--border)',
                    display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer',
                    background: selected?.id === alert.id ? 'rgba(0,212,255,0.04)' : 'transparent',
                    transition: 'background 0.15s',
                    opacity: alert.status === 'RESOLVED' ? 0.55 : 1,
                  }}
                >
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: lc.dot, flexShrink: 0, marginTop: 5, animation: alert.status === 'OPEN' ? 'pulse 2s infinite' : 'none' }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                      <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text)' }}>{alert.type}</span>
                      <span style={{ fontSize: 9, fontWeight: 600, color: lc.color, letterSpacing: '0.07em' }}>{alert.level}</span>
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--muted)' }}>
                      {alert.tx} {alert.amount != null ? `· $${alert.amount.toFixed(2)}` : ''} {alert.score != null ? `· Score: ${Math.round(alert.score * 100)}%` : ''}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                    <span style={{ fontSize: 9, padding: '2px 8px', borderRadius: 3, background: sc.bg, color: sc.color, border: `1px solid ${sc.border}`, letterSpacing: '0.07em', fontWeight: 600 }}>{alert.status}</span>
                    <span style={{ fontSize: 9, color: 'var(--muted)' }}>{alert.time}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </Panel>

        {selected && (
          <Panel title="Alert Detail" sub={selected.id} style={{ alignSelf: 'start', animation: 'slideIn 0.2s ease' }}>
            <div style={{ padding: 16 }}>
              <div style={{ padding: 14, background: LEVEL_COLORS[selected.level].bg, border: `1px solid ${LEVEL_COLORS[selected.level].border}`, borderRadius: 8, marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: LEVEL_COLORS[selected.level].color, marginBottom: 4 }}>
                  {selected.level} ALERT
                </div>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>{selected.type}</div>
              </div>

              {[
                ['Alert ID', selected.id],
                ['Transaction', selected.tx],
                ['Amount', selected.amount != null ? `$${selected.amount.toFixed(2)}` : '—'],
                ['Fraud Score', selected.score != null ? `${Math.round(selected.score * 100)}%` : '—'],
                ['Time', selected.time],
                ['Status', selected.status],
              ].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid rgba(30,45,74,0.4)', fontSize: 11 }}>
                  <span style={{ color: 'var(--muted)' }}>{k}</span>
                  <span style={{ color: 'var(--text)', fontWeight: 500 }}>{v}</span>
                </div>
              ))}

              {selected.features.length > 0 && (
                <div style={{ margin: '14px 0' }}>
                  <div style={{ fontSize: 9, color: 'var(--muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>Triggered Rules</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {selected.features.map(f => <Badge key={f} color="var(--danger)">{f}</Badge>)}
                  </div>
                </div>
              )}

              {selected.status !== 'RESOLVED' && (
                <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                  <button onClick={() => resolve(selected.id)} style={{
                    flex: 1, padding: '8px 0', background: 'rgba(0,224,150,0.1)', border: '1px solid rgba(0,224,150,0.3)',
                    borderRadius: 5, color: 'var(--ok)', fontSize: 10, letterSpacing: '0.08em', fontFamily: 'var(--font-mono)',
                  }}>RESOLVE</button>
                  <button onClick={() => dismiss(selected.id)} style={{
                    flex: 1, padding: '8px 0', background: 'rgba(255,69,96,0.08)', border: '1px solid rgba(255,69,96,0.3)',
                    borderRadius: 5, color: 'var(--danger)', fontSize: 10, letterSpacing: '0.08em', fontFamily: 'var(--font-mono)',
                  }}>DISMISS</button>
                </div>
              )}
            </div>
          </Panel>
        )}
      </div>
    </div>
  )
}
