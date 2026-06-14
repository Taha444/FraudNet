import React, { useEffect, useState, useCallback } from 'react'
import { fetchRecent } from '../api'
import { Panel, RiskPill, ScoreBar, Spinner, Badge } from '../components'

const FILTERS = ['ALL', 'HIGH', 'MEDIUM', 'LOW']

export default function Transactions() {
  const [txs, setTxs] = useState([])
  const [filter, setFilter] = useState('ALL')
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [search, setSearch] = useState('')

  const load = useCallback(() => {
    setLoading(true)
    const risk = filter === 'ALL' ? null : filter
    fetchRecent(40, risk)
      .then(d => { setTxs(d.transactions || MOCK_TXS); setLoading(false) })
      .catch(() => { setTxs(MOCK_TXS); setLoading(false) })
  }, [filter])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const interval = setInterval(load, 15000)
    return () => clearInterval(interval)
  }, [load])

  const filtered = txs.filter(t =>
    !search || t.id.includes(search.toUpperCase()) || String(t.amount).includes(search)
  )

  return (
    <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 320px' : '1fr', gap: 14, animation: 'fadeIn 0.4s ease' }}>
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
              letterSpacing: '0.07em',
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
              letterSpacing: '0.07em', transition: 'all 0.15s',
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
                  {['TX ID', 'Amount', 'V14 Feature', 'Time', 'Risk Score', 'Status', 'Flagged'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 9, color: 'var(--muted)', letterSpacing: '0.1em', textTransform: 'uppercase', borderBottom: '1px solid var(--border)', fontWeight: 500 }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(tx => (
                  <tr key={tx.id} onClick={() => setSelected(selected?.id === tx.id ? null : tx)}
                    style={{ cursor: 'pointer', background: selected?.id === tx.id ? 'rgba(0,212,255,0.05)' : 'transparent', transition: 'background 0.15s' }}
                    onMouseEnter={e => { if (selected?.id !== tx.id) e.currentTarget.style.background = 'rgba(255,255,255,0.02)' }}
                    onMouseLeave={e => { if (selected?.id !== tx.id) e.currentTarget.style.background = 'transparent' }}
                  >
                    <td style={{ padding: '9px 12px', borderBottom: '1px solid rgba(30,45,74,0.4)', color: 'var(--accent)', fontWeight: 500 }}>{tx.id}</td>
                    <td style={{ padding: '9px 12px', borderBottom: '1px solid rgba(30,45,74,0.4)', fontWeight: 500 }}>${tx.amount.toFixed(2)}</td>
                    <td style={{ padding: '9px 12px', borderBottom: '1px solid rgba(30,45,74,0.4)', color: tx.v14 < -2 ? 'var(--danger)' : 'var(--muted)' }}>{tx.v14}</td>
                    <td style={{ padding: '9px 12px', borderBottom: '1px solid rgba(30,45,74,0.4)', color: 'var(--muted)' }}>{tx.time}</td>
                    <td style={{ padding: '9px 12px', borderBottom: '1px solid rgba(30,45,74,0.4)', minWidth: 120 }}><ScoreBar score={tx.fraud_probability} /></td>
                    <td style={{ padding: '9px 12px', borderBottom: '1px solid rgba(30,45,74,0.4)' }}><RiskPill level={tx.risk_level} /></td>
                    <td style={{ padding: '9px 12px', borderBottom: '1px solid rgba(30,45,74,0.4)' }}>
                      {tx.flagged ? <span style={{ color: 'var(--danger)', fontSize: 10 }}>● FLAGGED</span> : <span style={{ color: 'var(--muted)', fontSize: 10 }}>○ CLEAR</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {selected && (
        <Panel title="Transaction Detail" sub={selected.id} style={{ alignSelf: 'start', animation: 'slideIn 0.2s ease' }}>
          <div style={{ padding: 16 }}>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 28, fontWeight: 600, color: selected.fraud_probability >= 0.75 ? 'var(--danger)' : selected.fraud_probability >= 0.4 ? 'var(--warn)' : 'var(--ok)', marginBottom: 4 }}>
                ${selected.amount.toFixed(2)}
              </div>
              <RiskPill level={selected.risk_level} />
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 9, color: 'var(--muted)', letterSpacing: '0.1em', marginBottom: 6, textTransform: 'uppercase' }}>Fraud Probability</div>
              <ScoreBar score={selected.fraud_probability} />
            </div>

            {[
              ['Transaction ID', selected.id],
              ['Time', selected.time],
              ['V14 Feature', selected.v14],
              ['Fraud Score', `${(selected.fraud_probability * 100).toFixed(1)}%`],
              ['Status', selected.flagged ? 'FLAGGED' : 'CLEAR'],
            ].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid rgba(30,45,74,0.4)', fontSize: 11 }}>
                <span style={{ color: 'var(--muted)' }}>{k}</span>
                <span style={{ color: 'var(--text)', fontWeight: 500 }}>{v}</span>
              </div>
            ))}

            <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
              <button style={{
                flex: 1, padding: '8px 0', background: 'rgba(255,69,96,0.12)', border: '1px solid rgba(255,69,96,0.35)',
                borderRadius: 5, color: 'var(--danger)', fontSize: 10, letterSpacing: '0.08em', fontFamily: 'var(--font-mono)',
              }}>BLOCK</button>
              <button style={{
                flex: 1, padding: '8px 0', background: 'rgba(0,224,150,0.1)', border: '1px solid rgba(0,224,150,0.3)',
                borderRadius: 5, color: 'var(--ok)', fontSize: 10, letterSpacing: '0.08em', fontFamily: 'var(--font-mono)',
              }}>APPROVE</button>
            </div>
          </div>
        </Panel>
      )}
    </div>
  )
}

// Synthetic fallback data
const MOCK_TXS = Array.from({ length: 25 }, (_, i) => {
  const scores = [0.97, 0.94, 0.88, 0.81, 0.62, 0.34, 0.28, 0.07, 0.03, 0.15]
  const score = scores[i % scores.length] + (Math.sin(i) * 0.05)
  const s = Math.max(0, Math.min(1, score))
  const risk = s >= 0.75 ? 'HIGH' : s >= 0.4 ? 'MEDIUM' : 'LOW'
  const h = String(8 + (i % 16)).padStart(2, '0')
  const m = String((i * 7) % 60).padStart(2, '0')
  return {
    id: `TX-${String(28400 - i).padStart(5, '0')}`,
    amount: parseFloat((10 + Math.abs(Math.sin(i * 1.3) * 4990)).toFixed(2)),
    v14: parseFloat((-3.5 + i * 0.2).toFixed(2)),
    time: `${h}:${m}`,
    fraud_probability: parseFloat(s.toFixed(3)),
    risk_level: risk,
    flagged: s >= 0.5,
  }
}).map((t, i) => ({ ...t, id: `TX-${String(28400 - i).padStart(5, '0')}` }))
