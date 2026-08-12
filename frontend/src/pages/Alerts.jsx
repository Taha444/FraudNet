import React, { useState, useEffect, useCallback, useRef } from 'react'
import { fetchAlerts, updateAlertStatus, createAlertsSocket } from '../api'
import { Panel, RiskPill, Badge, Spinner } from '../components'

const LEVEL_COLORS = {
  CRITICAL: { bg:'rgba(255,69,96,0.12)',  border:'rgba(255,69,96,0.35)',  color:'var(--danger)', dot:'#ff4560' },
  HIGH:     { bg:'rgba(245,158,11,0.10)', border:'rgba(245,158,11,0.3)',  color:'var(--warn)',   dot:'#f59e0b' },
  MEDIUM:   { bg:'rgba(0,212,255,0.07)',  border:'rgba(0,212,255,0.2)',   color:'var(--accent)', dot:'#00d4ff' },
}

const STATUS_COLORS = {
  OPEN:     { color:'var(--danger)', bg:'rgba(255,69,96,0.1)',   border:'rgba(255,69,96,0.3)' },
  REVIEW:   { color:'var(--warn)',   bg:'rgba(245,158,11,0.1)',  border:'rgba(245,158,11,0.3)' },
  RESOLVED: { color:'var(--ok)',     bg:'rgba(0,224,150,0.08)',  border:'rgba(0,224,150,0.25)' },
}

export default function Alerts({ user }) {
  const [alerts,   setAlerts]   = useState([])
  const [loading,  setLoading]  = useState(true)
  const [filter,   setFilter]   = useState('ALL')
  const [selected, setSelected] = useState(null)
  const [wsStatus, setWsStatus] = useState('connecting')
  const wsRef = useRef(null)

  const canEdit = ['admin','analyst'].includes(user?.role)

  // ── Load alerts from API ───────────────────────────────────────────────────
  const load = useCallback(() => {
    fetchAlerts()
      .then(d => setAlerts(d.alerts || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  // ── WebSocket for real-time updates ───────────────────────────────────────
  useEffect(() => {
    let reconnectTimer = null

    const connect = () => {
      if (wsRef.current) wsRef.current.close()

      wsRef.current = createAlertsSocket(
        (msg) => {
          if (msg.type === 'new_alert') {
            setAlerts(prev => {
              if (prev.find(a => a.id === msg.alert.id)) return prev
              return [msg.alert, ...prev]
            })
          }
          if (msg.type === 'alert_update') {
            setAlerts(prev => prev.map(a =>
              a.id === msg.alert_id ? { ...a, status: msg.status } : a
            ))
            setSelected(sel => sel?.id === msg.alert_id ? { ...sel, status: msg.status } : sel)
          }
        },
        () => {
          setWsStatus('reconnecting')
          reconnectTimer = setTimeout(connect, 4000)
        }
      )

      wsRef.current.onopen = () => setWsStatus('connected')
    }

    connect()
    return () => {
      clearTimeout(reconnectTimer)
      if (wsRef.current) wsRef.current.close()
    }
  }, [])

  // ── Status update ─────────────────────────────────────────────────────────
  const changeStatus = async (alertId, newStatus) => {
    try {
      await updateAlertStatus(alertId, newStatus)
      // Optimistic update (WS will confirm)
      setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, status: newStatus } : a))
      if (selected?.id === alertId) setSelected(s => ({ ...s, status: newStatus }))
    } catch (e) {
      console.error('Status update failed', e)
    }
  }

  const dismiss = (alertId) => {
    setAlerts(prev => prev.filter(a => a.id !== alertId))
    if (selected?.id === alertId) setSelected(null)
  }

  // ── Derived ───────────────────────────────────────────────────────────────
  const openCount     = alerts.filter(a => a.status === 'OPEN').length
  const criticalCount = alerts.filter(a => a.level === 'CRITICAL' && a.status === 'OPEN').length
  const reviewCount   = alerts.filter(a => a.status === 'REVIEW').length
  const resolvedCount = alerts.filter(a => a.status === 'RESOLVED').length

  const filtered = filter === 'ALL'      ? alerts
    : filter === 'OPEN'     ? alerts.filter(a => a.status !== 'RESOLVED')
    : alerts.filter(a => a.status === 'RESOLVED')

  return (
    <div style={{ animation: 'fadeIn 0.4s ease' }}>
      {/* Summary */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:18 }}>
        {[
          { label:'Open Alerts',    val:openCount,     color:'var(--danger)', top:'var(--danger)' },
          { label:'Critical',       val:criticalCount, color:'var(--danger)', top:'var(--danger)' },
          { label:'Under Review',   val:reviewCount,   color:'var(--warn)',   top:'var(--warn)' },
          { label:'Resolved',       val:resolvedCount, color:'var(--ok)',     top:'var(--ok)' },
        ].map(({ label, val, color, top }) => (
          <div key={label} style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:8, padding:16, position:'relative', overflow:'hidden' }}>
            <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:top }} />
            <div style={{ fontSize:9, color:'var(--muted)', letterSpacing:'0.12em', textTransform:'uppercase', marginBottom:6 }}>{label}</div>
            <div style={{ fontSize:30, fontWeight:600, color }}>{val}</div>
          </div>
        ))}
      </div>

      <div style={{ display:'grid', gridTemplateColumns: selected ? '1fr 320px' : '1fr', gap:14 }}>
        <Panel
          title="Alert Queue"
          sub={`${filtered.length} alerts`}
          headerRight={
            <div style={{ display:'flex', gap:8, alignItems:'center' }}>
              {/* WS indicator */}
              <div style={{ display:'flex', alignItems:'center', gap:5, fontSize:9, color:'var(--muted)' }}>
                <span style={{
                  width:6, height:6, borderRadius:'50%', display:'inline-block',
                  background: wsStatus === 'connected' ? 'var(--ok)' : 'var(--warn)',
                  animation: wsStatus === 'connected' ? 'pulse 2s infinite' : 'none',
                }} />
                {wsStatus === 'connected' ? 'LIVE' : 'RECONNECTING'}
              </div>
              {['ALL','OPEN','RESOLVED'].map(f => (
                <button key={f} onClick={() => setFilter(f)} style={{
                  padding:'4px 12px', borderRadius:4, fontSize:9, fontFamily:'var(--font-mono)',
                  border:`1px solid ${filter===f ? 'var(--accent)' : 'var(--border)'}`,
                  background: filter===f ? 'rgba(0,212,255,0.1)' : 'var(--surface2)',
                  color: filter===f ? 'var(--accent)' : 'var(--muted)', letterSpacing:'0.07em',
                  cursor:'pointer',
                }}>{f}</button>
              ))}
            </div>
          }
        >
          {loading ? <Spinner /> : (
            <div>
              {filtered.map(alert => {
                const lc = LEVEL_COLORS[alert.level] || LEVEL_COLORS.MEDIUM
                const sc = STATUS_COLORS[alert.status] || STATUS_COLORS.OPEN
                return (
                  <div key={alert.id}
                    onClick={() => setSelected(selected?.id === alert.id ? null : alert)}
                    style={{
                      padding:'12px 16px', borderBottom:'1px solid var(--border)',
                      display:'flex', alignItems:'flex-start', gap:12, cursor:'pointer',
                      background: selected?.id === alert.id ? 'rgba(0,212,255,0.04)' : 'transparent',
                      transition:'background 0.15s',
                      opacity: alert.status === 'RESOLVED' ? 0.55 : 1,
                    }}
                    onMouseEnter={e => { if (selected?.id !== alert.id) e.currentTarget.style.background='rgba(255,255,255,0.02)' }}
                    onMouseLeave={e => { if (selected?.id !== alert.id) e.currentTarget.style.background='transparent' }}
                  >
                    <div style={{ width:8, height:8, borderRadius:'50%', background:lc.dot, flexShrink:0, marginTop:5, animation: alert.status==='OPEN' ? 'pulse 2s infinite' : 'none' }} />
                    <div style={{ flex:1 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:3 }}>
                        <span style={{ fontSize:11, fontWeight:500, color:'var(--text)' }}>{alert.type}</span>
                        <span style={{ fontSize:9, fontWeight:600, color:lc.color, letterSpacing:'0.07em' }}>{alert.level}</span>
                      </div>
                      <div style={{ fontSize:10, color:'var(--muted)' }}>
                        {alert.tx || alert.id}
                        {alert.amount != null ? ` · $${alert.amount.toFixed(2)}` : ''}
                        {alert.score  != null ? ` · Score: ${Math.round(alert.score*100)}%` : ''}
                      </div>
                    </div>
                    <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:4, flexShrink:0 }}>
                      <span style={{ fontSize:9, padding:'2px 8px', borderRadius:3, background:sc.bg, color:sc.color, border:`1px solid ${sc.border}`, letterSpacing:'0.07em', fontWeight:600 }}>
                        {alert.status}
                      </span>
                      <span style={{ fontSize:9, color:'var(--muted)' }}>{alert.time}</span>
                    </div>
                  </div>
                )
              })}
              {!filtered.length && (
                <div style={{ padding:32, textAlign:'center', color:'var(--muted)', fontSize:11 }}>
                  No alerts to display
                </div>
              )}
            </div>
          )}
        </Panel>

        {selected && (
          <Panel title="Alert Detail" sub={selected.id} style={{ alignSelf:'start', animation:'slideIn 0.2s ease' }}>
            <div style={{ padding:16 }}>
              <div style={{ padding:14, background:LEVEL_COLORS[selected.level]?.bg, border:`1px solid ${LEVEL_COLORS[selected.level]?.border}`, borderRadius:8, marginBottom:16 }}>
                <div style={{ fontSize:13, fontWeight:600, color:LEVEL_COLORS[selected.level]?.color, marginBottom:4 }}>
                  {selected.level} ALERT
                </div>
                <div style={{ fontSize:11, color:'var(--muted)' }}>{selected.type}</div>
              </div>

              {[
                ['Alert ID',    selected.id],
                ['Transaction', selected.tx || selected.id],
                ['Amount',      selected.amount != null ? `$${selected.amount.toFixed(2)}` : '—'],
                ['Fraud Score', selected.score  != null ? `${Math.round(selected.score*100)}%` : '—'],
                ['Status',      selected.status],
                ['Time',        selected.time],
              ].map(([k, v]) => (
                <div key={k} style={{ display:'flex', justifyContent:'space-between', padding:'7px 0', borderBottom:'1px solid rgba(30,45,74,0.4)', fontSize:11 }}>
                  <span style={{ color:'var(--muted)' }}>{k}</span>
                  <span style={{ color:'var(--text)', fontWeight:500 }}>{v}</span>
                </div>
              ))}

              {(selected.features || []).length > 0 && (
                <div style={{ margin:'14px 0' }}>
                  <div style={{ fontSize:9, color:'var(--muted)', letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:8 }}>Triggered Features</div>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                    {selected.features.map(f => <Badge key={f} color="var(--danger)">{f}</Badge>)}
                  </div>
                </div>
              )}

              {selected.status !== 'RESOLVED' && canEdit && (
                <div style={{ display:'flex', gap:8, marginTop:16 }}>
                  {selected.status === 'OPEN' && (
                    <button onClick={() => changeStatus(selected.id, 'REVIEW')} style={{ flex:1, padding:'8px 0', background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.3)', borderRadius:5, color:'var(--warn)', fontSize:10, letterSpacing:'0.08em', fontFamily:'var(--font-mono)', cursor:'pointer' }}>
                      REVIEW
                    </button>
                  )}
                  <button onClick={() => changeStatus(selected.id, 'RESOLVED')} style={{ flex:1, padding:'8px 0', background:'rgba(0,224,150,0.1)', border:'1px solid rgba(0,224,150,0.3)', borderRadius:5, color:'var(--ok)', fontSize:10, letterSpacing:'0.08em', fontFamily:'var(--font-mono)', cursor:'pointer' }}>
                    RESOLVE
                  </button>
                  <button onClick={() => dismiss(selected.id)} style={{ flex:1, padding:'8px 0', background:'rgba(255,69,96,0.08)', border:'1px solid rgba(255,69,96,0.3)', borderRadius:5, color:'var(--danger)', fontSize:10, letterSpacing:'0.08em', fontFamily:'var(--font-mono)', cursor:'pointer' }}>
                    DISMISS
                  </button>
                </div>
              )}
            </div>
          </Panel>
        )}
      </div>
    </div>
  )
}
