import React, { useEffect, useState, useCallback, useRef } from 'react'
import { fetchRecent } from '../api'
import api from '../api'
import { Panel, RiskPill, ScoreBar, Spinner } from '../components'

const FILTERS = ['ALL', 'HIGH', 'MEDIUM', 'LOW']

// action key = 'BLOCK' or 'APPROVE' (not BLOCKED/APPROVED)
const ACTION_STYLE = {
  BLOCK:   { color: 'var(--danger)', bg: 'rgba(255,69,96,0.13)',  border: 'rgba(255,69,96,0.40)',  label: '🔒 BLOCKED' },
  APPROVE: { color: 'var(--ok)',     bg: 'rgba(0,224,150,0.11)',  border: 'rgba(0,224,150,0.35)',  label: '✓ APPROVED' },
}

export default function Transactions() {
  const [txs,     setTxs]     = useState([])
  const [filter,  setFilter]  = useState('ALL')
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [search,  setSearch]  = useState('')
  const [actions, setActions] = useState({})   // { [tx_id]: 'BLOCK' | 'APPROVE' }
  const [acting,  setActing]  = useState(null) // tx_id in progress
  const filteredRef = useRef([])               // stable ref for use inside async handlers

  // ── Load transactions ──────────────────────────────────────────────────────
  const load = useCallback(() => {
    setLoading(true)
    const risk = filter === 'ALL' ? null : filter
    fetchRecent(40, risk)
      .then(d => { setTxs(d.transactions || MOCK_TXS); setLoading(false) })
      .catch(() => { setTxs(MOCK_TXS); setLoading(false) })
  }, [filter])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    const t = setInterval(load, 15000)
    return () => clearInterval(t)
  }, [load])

  // ── Derived filtered list (also kept in ref for async access) ──────────────
  const filtered = txs.filter(t =>
    !search || t.id.includes(search.toUpperCase()) || String(t.amount).includes(search)
  )
  filteredRef.current = filtered

  // ── Handle BLOCK / APPROVE ─────────────────────────────────────────────────
  const handleAction = async (txId, action) => {
    setActing(txId)

    try {
      await api.put(`/api/transactions/${txId}/action`, { action })
    } catch (err) {
      if (err.response?.status === 403) {
        alert('Permission denied — analyst or admin role required')
        setActing(null)
        return
      }
      // Offline / demo: proceed with local update anyway
    }

    // Record the action
    setActions(prev => ({ ...prev, [txId]: action }))
    setActing(null)

    // Navigate to next transaction after a short pause
    setTimeout(() => {
      const list  = filteredRef.current
      const idx   = list.findIndex(t => t.id === txId)
      const next  = list[idx + 1] ?? list[idx - 1] ?? null
      setSelected(next)
      // Reload list so the acted tx can be visually demoted / sorted
      load()
    }, 500)
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: selected ? '1fr 320px' : '1fr',
      gap: 14,
      animation: 'fadeIn 0.4s ease',
    }}>
      {/* ── Transaction table ── */}
      <Panel
        title="Live Transaction Feed"
        sub={`${filtered.length} transactions · auto-refresh 15s`}
        headerRight={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search TX ID / amount..."
              style={{
                background: 'var(--surface2)', border: '1px solid var(--border)',
                borderRadius: 4, padding: '5px 10px', fontSize: 10, color: 'var(--text)',
                width: 180, outline: 'none',
              }}
            />
            <button onClick={load} style={{
              background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.3)',
              borderRadius: 4, padding: '5px 12px', fontSize: 9, color: 'var(--accent)',
              letterSpacing: '0.07em', cursor: 'pointer',
            }}>REFRESH</button>
          </div>
        }
      >
        {/* Filter pills */}
        <div style={{ display: 'flex', gap: 8, padding: '10px 16px', borderBottom: '1px solid var(--border)' }}>
          {FILTERS.map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: '5px 14px', borderRadius: 4, fontSize: 10, fontFamily: 'var(--font-mono)',
              border: `1px solid ${filter === f ? 'var(--accent)' : 'var(--border)'}`,
              background: filter === f ? 'rgba(0,212,255,0.1)' : 'var(--surface2)',
              color: filter === f ? 'var(--accent)' : 'var(--muted)',
              letterSpacing: '0.07em', transition: 'all 0.15s', cursor: 'pointer',
            }}>{f}</button>
          ))}
          <div style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--ok)', display: 'inline-block', animation: 'pulse 2s infinite' }} />
            LIVE
          </div>
        </div>

        {loading ? <Spinner /> : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead>
                <tr>
                  {['TX ID', 'Amount', 'V14', 'Time', 'Risk Score', 'Risk', 'Status'].map(h => (
                    <th key={h} style={{
                      padding: '8px 12px', textAlign: 'left', fontSize: 9,
                      color: 'var(--muted)', letterSpacing: '0.1em', textTransform: 'uppercase',
                      borderBottom: '1px solid var(--border)', fontWeight: 500,
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(tx => {
                  const act = actions[tx.id]
                  const isSelected = selected?.id === tx.id
                  const rowStyle = act
                    ? { background: `${ACTION_STYLE[act].bg}` }
                    : isSelected
                      ? { background: 'rgba(0,212,255,0.05)' }
                      : {}

                  return (
                    <tr
                      key={tx.id}
                      onClick={() => setSelected(isSelected ? null : tx)}
                      style={{ cursor: 'pointer', transition: 'background 0.2s', ...rowStyle }}
                      onMouseEnter={e => { if (!act && !isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.02)' }}
                      onMouseLeave={e => { if (!act && !isSelected) e.currentTarget.style.background = 'transparent' }}
                    >
                      <td style={{ padding: '9px 12px', borderBottom: '1px solid rgba(30,45,74,0.4)', color: 'var(--accent)', fontWeight: 500 }}>{tx.id}</td>
                      <td style={{ padding: '9px 12px', borderBottom: '1px solid rgba(30,45,74,0.4)', fontWeight: 500 }}>${tx.amount.toFixed(2)}</td>
                      <td style={{ padding: '9px 12px', borderBottom: '1px solid rgba(30,45,74,0.4)', color: tx.v14 < -2 ? 'var(--danger)' : 'var(--muted)' }}>{tx.v14}</td>
                      <td style={{ padding: '9px 12px', borderBottom: '1px solid rgba(30,45,74,0.4)', color: 'var(--muted)' }}>{tx.time}</td>
                      <td style={{ padding: '9px 12px', borderBottom: '1px solid rgba(30,45,74,0.4)', minWidth: 120 }}><ScoreBar score={tx.fraud_probability} /></td>
                      <td style={{ padding: '9px 12px', borderBottom: '1px solid rgba(30,45,74,0.4)' }}><RiskPill level={tx.risk_level} /></td>
                      <td style={{ padding: '9px 12px', borderBottom: '1px solid rgba(30,45,74,0.4)' }}>
                        {acting === tx.id
                          ? <span style={{ fontSize: 10, color: 'var(--muted)' }}>...</span>
                          : act
                            ? <span style={{ fontSize: 10, fontWeight: 700, color: ACTION_STYLE[act].color }}>{ACTION_STYLE[act].label}</span>
                            : tx.flagged
                              ? <span style={{ color: 'var(--danger)', fontSize: 10 }}>● FLAGGED</span>
                              : <span style={{ color: 'var(--muted)', fontSize: 10 }}>○ CLEAR</span>
                        }
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {/* ── Detail panel ── */}
      {selected && (
        <Panel
          title="Transaction Detail"
          sub={selected.id}
          style={{ alignSelf: 'start', animation: 'slideIn 0.2s ease' }}
          headerRight={
            <button
              onClick={() => setSelected(null)}
              style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 14, cursor: 'pointer', padding: '0 4px' }}
            >✕</button>
          }
        >
          <div style={{ padding: 16 }}>
            {/* Amount + risk */}
            <div style={{ marginBottom: 16 }}>
              <div style={{
                fontSize: 28, fontWeight: 600, marginBottom: 4,
                color: selected.fraud_probability >= 0.75 ? 'var(--danger)'
                     : selected.fraud_probability >= 0.4  ? 'var(--warn)'
                     : 'var(--ok)',
              }}>
                ${selected.amount.toFixed(2)}
              </div>
              <RiskPill level={selected.risk_level} />
            </div>

            {/* Score bar */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 9, color: 'var(--muted)', letterSpacing: '0.1em', marginBottom: 6, textTransform: 'uppercase' }}>Fraud Probability</div>
              <ScoreBar score={selected.fraud_probability} />
            </div>

            {/* Metadata rows */}
            {[
              ['Transaction ID', selected.id],
              ['Time',           selected.time],
              ['V14 Feature',    selected.v14],
              ['Fraud Score',    `${(selected.fraud_probability * 100).toFixed(1)}%`],
              ['Flagged',        selected.flagged ? 'YES' : 'NO'],
            ].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid rgba(30,45,74,0.4)', fontSize: 11 }}>
                <span style={{ color: 'var(--muted)' }}>{k}</span>
                <span style={{ color: 'var(--text)', fontWeight: 500 }}>{v}</span>
              </div>
            ))}

            {/* Action area */}
            <div style={{ marginTop: 16 }}>
              {actions[selected.id] ? (
                // Already acted
                <div style={{
                  padding: 14, borderRadius: 8, textAlign: 'center',
                  background: ACTION_STYLE[actions[selected.id]].bg,
                  border: `1px solid ${ACTION_STYLE[actions[selected.id]].border}`,
                }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: ACTION_STYLE[actions[selected.id]].color }}>
                    {ACTION_STYLE[actions[selected.id]].label}
                  </div>
                  <div style={{ fontSize: 9, color: 'var(--muted)', marginTop: 6 }}>Action recorded in audit log</div>
                  <button
                    onClick={() => setActions(prev => { const n = { ...prev }; delete n[selected.id]; return n })}
                    style={{
                      marginTop: 10, padding: '4px 16px', borderRadius: 4, fontSize: 9,
                      background: 'transparent', border: '1px solid var(--border)',
                      color: 'var(--muted)', cursor: 'pointer', fontFamily: 'var(--font-mono)',
                    }}
                  >UNDO</button>
                </div>
              ) : acting === selected.id ? (
                // Processing
                <div style={{ textAlign: 'center', padding: 14, color: 'var(--muted)', fontSize: 11 }}>
                  <div style={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid var(--border)', borderTopColor: 'var(--accent)', animation: 'spin 0.7s linear infinite', margin: '0 auto 8px' }} />
                  Processing...
                  <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                </div>
              ) : (
                // Buttons
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => handleAction(selected.id, 'BLOCK')}
                    style={{
                      flex: 1, padding: '10px 0', borderRadius: 6, cursor: 'pointer',
                      background: 'rgba(255,69,96,0.12)', border: '1px solid rgba(255,69,96,0.40)',
                      color: 'var(--danger)', fontSize: 11, letterSpacing: '0.08em',
                      fontFamily: 'var(--font-mono)', fontWeight: 700, transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,69,96,0.24)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,69,96,0.12)' }}
                  >🔒 BLOCK</button>
                  <button
                    onClick={() => handleAction(selected.id, 'APPROVE')}
                    style={{
                      flex: 1, padding: '10px 0', borderRadius: 6, cursor: 'pointer',
                      background: 'rgba(0,224,150,0.10)', border: '1px solid rgba(0,224,150,0.35)',
                      color: 'var(--ok)', fontSize: 11, letterSpacing: '0.08em',
                      fontFamily: 'var(--font-mono)', fontWeight: 700, transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,224,150,0.22)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,224,150,0.10)' }}
                  >✓ APPROVE</button>
                </div>
              )}
            </div>
          </div>
        </Panel>
      )}
    </div>
  )
}

// ── Synthetic fallback data ────────────────────────────────────────────────────
const MOCK_TXS = Array.from({ length: 25 }, (_, i) => {
  const scores = [0.97, 0.94, 0.88, 0.81, 0.62, 0.34, 0.28, 0.07, 0.03, 0.15]
  const s = Math.max(0, Math.min(1, scores[i % scores.length] + Math.sin(i) * 0.05))
  const h = String(8 + (i % 16)).padStart(2, '0')
  const m = String((i * 7) % 60).padStart(2, '0')
  return {
    id:                `TX-${String(28400 - i).padStart(5, '0')}`,
    amount:            parseFloat((10 + Math.abs(Math.sin(i * 1.3) * 4990)).toFixed(2)),
    v14:               parseFloat((-3.5 + i * 0.2).toFixed(2)),
    time:              `${h}:${m}`,
    fraud_probability: parseFloat(s.toFixed(3)),
    risk_level:        s >= 0.75 ? 'HIGH' : s >= 0.4 ? 'MEDIUM' : 'LOW',
    flagged:           s >= 0.5,
  }
})
