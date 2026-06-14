import React from 'react'

const s = {
  panel: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    overflow: 'hidden',
  },
  panelHeader: {
    padding: '11px 16px',
    borderBottom: '1px solid var(--border)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  panelTitle: {
    fontSize: 10,
    fontWeight: 600,
    color: 'var(--text)',
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
  },
  panelSub: { fontSize: 10, color: 'var(--muted)' },
}

export function Panel({ title, sub, children, style, headerRight }) {
  return (
    <div style={{ ...s.panel, ...style }}>
      {title && (
        <div style={s.panelHeader}>
          <div>
            <div style={s.panelTitle}>{title}</div>
            {sub && <div style={s.panelSub}>{sub}</div>}
          </div>
          {headerRight}
        </div>
      )}
      {children}
    </div>
  )
}

export function MetricCard({ label, value, sub, trend, trendUp, color, topColor }) {
  const tc = topColor || color || 'var(--accent)'
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 8, padding: 16, position: 'relative', overflow: 'hidden',
      animation: 'fadeIn 0.4s ease',
    }}>
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: tc,
      }} />
      <div style={{ fontSize: 9, color: 'var(--muted)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 26, fontWeight: 600, color: color || 'var(--text)', lineHeight: 1 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4 }}>{sub}</div>}
      {trend && (
        <div style={{ fontSize: 10, color: trendUp ? 'var(--danger)' : 'var(--ok)', marginTop: 4 }}>
          {trendUp ? '▲' : '▼'} {trend}
        </div>
      )}
    </div>
  )
}

export function RiskPill({ level }) {
  const map = {
    HIGH:   { bg: 'rgba(255,69,96,0.18)',  color: 'var(--danger)', border: 'rgba(255,69,96,0.4)' },
    MEDIUM: { bg: 'rgba(245,158,11,0.14)', color: 'var(--warn)',   border: 'rgba(245,158,11,0.35)' },
    LOW:    { bg: 'rgba(0,224,150,0.12)',  color: 'var(--ok)',     border: 'rgba(0,224,150,0.3)' },
  }
  const c = map[level] || map.LOW
  return (
    <span style={{
      padding: '2px 8px', borderRadius: 3,
      fontSize: 9, fontWeight: 600, letterSpacing: '0.08em',
      background: c.bg, color: c.color, border: `1px solid ${c.border}`,
    }}>
      {level}
    </span>
  )
}

export function ScoreBar({ score }) {
  const color = score >= 0.75 ? 'var(--danger)' : score >= 0.4 ? 'var(--warn)' : 'var(--ok)'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 4, background: 'var(--surface3)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${Math.round(score * 100)}%`, height: '100%', background: color, borderRadius: 2 }} />
      </div>
      <span style={{ fontSize: 10, color, width: 32, textAlign: 'right', fontWeight: 500 }}>
        {Math.round(score * 100)}%
      </span>
    </div>
  )
}

export function Badge({ children, color = 'var(--accent)' }) {
  return (
    <span style={{
      padding: '3px 10px', borderRadius: 4,
      fontSize: 9, fontWeight: 600, letterSpacing: '0.07em',
      background: `${color}18`, color, border: `1px solid ${color}40`,
    }}>
      {children}
    </span>
  )
}

export function Spinner() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
      <div style={{
        width: 24, height: 24, borderRadius: '50%',
        border: '2px solid var(--border)',
        borderTopColor: 'var(--accent)',
        animation: 'spin 0.8s linear infinite',
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

export function StatusDot({ color = 'var(--ok)' }) {
  return (
    <span style={{
      display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
      background: color, animation: 'pulse 2s infinite', marginRight: 6,
    }} />
  )
}
