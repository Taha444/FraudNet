import React, { useEffect, useState } from 'react'
import { fetchThresholds, saveThresholds, fetchAuditLog, registerUser } from '../api'
import { Panel, Spinner, Badge } from '../components'

const C = { accent:'#00d4ff', danger:'#ff4560', warn:'#f59e0b', ok:'#00e096', muted:'#5a6a8a', text:'#c8d6f0' }

function Slider({ label, sub, value, min = 0.01, max = 0.99, step = 0.01, color, onChange }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)' }}>{label}</div>
          <div style={{ fontSize: 9,  color: 'var(--muted)' }}>{sub}</div>
        </div>
        <div style={{
          fontSize: 20, fontWeight: 700, color,
          padding: '2px 10px', background: `${color}18`,
          border: `1px solid ${color}40`, borderRadius: 6,
        }}>
          {Math.round(value * 100)}%
        </div>
      </div>
      <input
        type="range"
        min={min} max={max} step={step}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        style={{ width: '100%', accentColor: color, height: 6, cursor: 'pointer' }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--muted)', marginTop: 4 }}>
        <span>{Math.round(min * 100)}% (safe)</span>
        <span>{Math.round(max * 100)}% (strict)</span>
      </div>
    </div>
  )
}

export default function Settings({ user }) {
  const isAdmin = user?.role === 'admin'

  const [thresh,  setThresh]  = useState(null)
  const [draft,   setDraft]   = useState(null)
  const [saving,  setSaving]  = useState(false)
  const [saved,   setSaved]   = useState(false)
  const [errMsg,  setErrMsg]  = useState(null)

  const [auditLog,  setAuditLog]  = useState([])
  const [auditLoad, setAuditLoad] = useState(true)

  const [regForm,  setRegForm]  = useState({ username:'', email:'', password:'', role:'analyst' })
  const [regMsg,   setRegMsg]   = useState(null)
  const [regErr,   setRegErr]   = useState(null)

  useEffect(() => {
    fetchThresholds()
      .then(d => { setThresh(d); setDraft({ ...d }) })
      .catch(() => {
        const def = { fraud_threshold: 0.5, high_risk_threshold: 0.75, medium_risk_threshold: 0.4 }
        setThresh(def); setDraft({ ...def })
      })
    if (isAdmin) {
      fetchAuditLog(50)
        .then(d => setAuditLog(d.logs || []))
        .catch(() => {})
        .finally(() => setAuditLoad(false))
    }
  }, [isAdmin])

  const handleSave = async () => {
    if (draft.medium_risk_threshold >= draft.high_risk_threshold) {
      setErrMsg('High-risk threshold must be greater than medium-risk'); return
    }
    setSaving(true); setSaved(false); setErrMsg(null)
    try {
      const res = await saveThresholds(draft)
      setThresh({ ...draft }); setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (e) {
      setErrMsg(e.response?.data?.detail || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const handleRegister = async (e) => {
    e.preventDefault()
    setRegMsg(null); setRegErr(null)
    try {
      await registerUser(regForm)
      setRegMsg(`User "${regForm.username}" created as ${regForm.role}`)
      setRegForm({ username:'', email:'', password:'', role:'analyst' })
    } catch (err) {
      setRegErr(err.response?.data?.detail || 'Registration failed')
    }
  }

  if (!draft) return <Spinner />

  return (
    <div style={{ animation: 'fadeIn 0.4s ease' }}>

      {!isAdmin && (
        <div style={{ padding:'10px 16px', background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.25)', borderRadius:6, marginBottom:18, fontSize:11, color:'var(--warn)' }}>
          You have <strong>viewer</strong> access. Threshold editing and user management require the <strong>admin</strong> role.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>

        {/* Thresholds */}
        <Panel title="Fraud Detection Thresholds" sub="Tune model decision boundaries">
          <div style={{ padding: 20 }}>
            {errMsg && (
              <div style={{ padding:'8px 12px', background:'rgba(255,69,96,0.08)', border:'1px solid rgba(255,69,96,0.3)', borderRadius:6, fontSize:11, color:'var(--danger)', marginBottom:16 }}>
                {errMsg}
              </div>
            )}

            <Slider
              label="Fraud Decision Threshold"
              sub="Probability above this → transaction flagged as fraud"
              value={draft.fraud_threshold}
              color={C.danger}
              onChange={v => setDraft(d => ({ ...d, fraud_threshold: v }))}
            />
            <Slider
              label="HIGH Risk Threshold"
              sub="Probability above this → HIGH risk level"
              value={draft.high_risk_threshold}
              color={C.warn}
              onChange={v => setDraft(d => ({ ...d, high_risk_threshold: v }))}
            />
            <Slider
              label="MEDIUM Risk Threshold"
              sub="Probability above this → MEDIUM risk level"
              value={draft.medium_risk_threshold}
              color={C.accent}
              onChange={v => setDraft(d => ({ ...d, medium_risk_threshold: v }))}
            />

            {/* Preview */}
            <div style={{ display:'flex', gap:8, marginBottom:20, padding:12, background:'var(--surface2)', borderRadius:6, border:'1px solid var(--border)' }}>
              {[
                { label:'LOW',    range:`0% – ${Math.round(draft.medium_risk_threshold*100)}%`, color:C.ok },
                { label:'MEDIUM', range:`${Math.round(draft.medium_risk_threshold*100)}% – ${Math.round(draft.high_risk_threshold*100)}%`, color:C.accent },
                { label:'HIGH',   range:`${Math.round(draft.high_risk_threshold*100)}% – 100%`, color:C.warn },
              ].map(({ label, range, color }) => (
                <div key={label} style={{ flex:1, textAlign:'center' }}>
                  <div style={{ fontSize:9, fontWeight:600, color, letterSpacing:'0.07em' }}>{label}</div>
                  <div style={{ fontSize:9, color:'var(--muted)', marginTop:2 }}>{range}</div>
                </div>
              ))}
            </div>

            {isAdmin ? (
              <button onClick={handleSave} disabled={saving} style={{
                width:'100%', padding:'10px 0', borderRadius:6,
                background: saved ? 'rgba(0,224,150,0.12)' : 'rgba(0,212,255,0.12)',
                border: `1px solid ${saved ? 'rgba(0,224,150,0.35)' : 'rgba(0,212,255,0.35)'}`,
                color: saved ? C.ok : C.accent,
                fontSize:11, fontWeight:600, letterSpacing:'0.1em', fontFamily:'var(--font-mono)',
                cursor: saving ? 'wait' : 'pointer',
              }}>
                {saving ? 'SAVING...' : saved ? '✓ SAVED' : 'SAVE THRESHOLDS'}
              </button>
            ) : (
              <div style={{ textAlign:'center', fontSize:10, color:'var(--muted)', padding:'8px 0' }}>
                Read-only — admin required to save
              </div>
            )}
          </div>
        </Panel>

        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>

          {/* Register user (admin only) */}
          {isAdmin && (
            <Panel title="User Management" sub="Create new accounts">
              <form onSubmit={handleRegister} style={{ padding: 16 }}>
                {regMsg && <div style={{ padding:'7px 10px', background:'rgba(0,224,150,0.08)', border:'1px solid rgba(0,224,150,0.25)', borderRadius:5, fontSize:10, color:C.ok, marginBottom:12 }}>{regMsg}</div>}
                {regErr && <div style={{ padding:'7px 10px', background:'rgba(255,69,96,0.08)', border:'1px solid rgba(255,69,96,0.25)', borderRadius:5, fontSize:10, color:C.danger, marginBottom:12 }}>{regErr}</div>}

                {[
                  { key:'username', label:'Username',       type:'text',     ph:'johndoe' },
                  { key:'email',    label:'Email',          type:'email',    ph:'john@example.com' },
                  { key:'password', label:'Password',       type:'password', ph:'••••••••' },
                ].map(({ key, label, type, ph }) => (
                  <div key={key} style={{ marginBottom:10 }}>
                    <label style={{ fontSize:9, color:'var(--muted)', letterSpacing:'0.08em', textTransform:'uppercase', display:'block', marginBottom:4 }}>{label}</label>
                    <input
                      type={type} value={regForm[key]} placeholder={ph}
                      onChange={e => setRegForm(f => ({ ...f, [key]: e.target.value }))}
                      style={{ width:'100%', background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:4, padding:'7px 10px', fontSize:11, color:'var(--text)', outline:'none', fontFamily:'var(--font-mono)', boxSizing:'border-box' }}
                      onFocus={e => e.target.style.borderColor='var(--accent)'}
                      onBlur={e  => e.target.style.borderColor='var(--border)'}
                    />
                  </div>
                ))}

                <div style={{ marginBottom:12 }}>
                  <label style={{ fontSize:9, color:'var(--muted)', letterSpacing:'0.08em', textTransform:'uppercase', display:'block', marginBottom:4 }}>Role</label>
                  <select value={regForm.role} onChange={e => setRegForm(f => ({ ...f, role: e.target.value }))} style={{ width:'100%', background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:4, padding:'7px 10px', fontSize:11, color:'var(--text)', outline:'none', fontFamily:'var(--font-mono)' }}>
                    <option value="viewer">Viewer</option>
                    <option value="analyst">Analyst</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>

                <button type="submit" style={{ width:'100%', padding:'8px 0', borderRadius:5, background:'rgba(0,212,255,0.1)', border:'1px solid rgba(0,212,255,0.3)', color:C.accent, fontSize:10, fontWeight:600, letterSpacing:'0.08em', fontFamily:'var(--font-mono)', cursor:'pointer' }}>
                  CREATE USER
                </button>
              </form>
            </Panel>
          )}

          {/* System info */}
          <Panel title="System Info" sub="Runtime configuration">
            <div style={{ padding: 16 }}>
              {[
                ['API Version',  'v3.0.0'],
                ['ML Model',     'XGBoost (300 trees)'],
                ['Explainability','SHAP TreeExplainer'],
                ['Auth',         'JWT · 8-hour tokens'],
                ['Database',     'SQLite (fraudnet.db)'],
                ['Rate Limit',   '60 req/min (predict)'],
              ].map(([k, v]) => (
                <div key={k} style={{ display:'flex', justifyContent:'space-between', padding:'7px 0', borderBottom:'1px solid rgba(30,45,74,0.4)', fontSize:11 }}>
                  <span style={{ color:'var(--muted)' }}>{k}</span>
                  <span style={{ color:'var(--text)', fontWeight:500 }}>{v}</span>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>

      {/* Audit log (admin only) */}
      {isAdmin && (
        <Panel title="Audit Log" sub="Last 50 actions" style={{ marginTop: 14 }}>
          {auditLoad ? <Spinner /> : (
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:11 }}>
                <thead>
                  <tr>
                    {['User','Action','Target','Time'].map(h => (
                      <th key={h} style={{ padding:'8px 14px', textAlign:'left', fontSize:9, color:'var(--muted)', letterSpacing:'0.1em', textTransform:'uppercase', borderBottom:'1px solid var(--border)', fontWeight:500 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {auditLog.map(row => (
                    <tr key={row.id}
                      onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.02)'}
                      onMouseLeave={e => e.currentTarget.style.background='transparent'}
                    >
                      <td style={{ padding:'7px 14px', borderBottom:'1px solid rgba(30,45,74,0.4)', color:C.accent }}>{row.username}</td>
                      <td style={{ padding:'7px 14px', borderBottom:'1px solid rgba(30,45,74,0.4)' }}>
                        <Badge color={row.action.startsWith('LOGIN') ? C.ok : row.action.includes('PREDICT') ? C.accent : C.warn}>{row.action}</Badge>
                      </td>
                      <td style={{ padding:'7px 14px', borderBottom:'1px solid rgba(30,45,74,0.4)', color:'var(--muted)' }}>{row.target || '—'}</td>
                      <td style={{ padding:'7px 14px', borderBottom:'1px solid rgba(30,45,74,0.4)', color:'var(--muted)', fontSize:10 }}>
                        {new Date(row.created_at).toLocaleTimeString()}
                      </td>
                    </tr>
                  ))}
                  {!auditLog.length && (
                    <tr><td colSpan={4} style={{ padding:20, textAlign:'center', color:'var(--muted)', fontSize:11 }}>No audit entries yet</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      )}
    </div>
  )
}
