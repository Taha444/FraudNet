import React, { useState } from 'react'
import { predictTx } from '../api'
import { Panel, RiskPill, ScoreBar, Badge } from '../components'

const DEFAULT_TX = {
  time:75432, v1:-1.36, v2:-0.07, v3:2.54,  v4:1.38,  v5:-0.34,
  v6:0.46,   v7:0.24,  v8:0.10,  v9:0.36,  v10:0.09,
  v11:-0.55, v12:-0.62,v13:-0.99,v14:-0.31, v15:-0.47,
  v16:0.21,  v17:0.04, v18:0.40, v19:0.25,  v20:-0.02,
  v21:0.28,  v22:0.77, v23:0.23, v24:0.26,  v25:-0.24,
  v26:0.04,  v27:0.62, v28:0.62, amount:149.62,
}

const FRAUD_PRESET = {
  time:406,   v1:-2.31,v2:1.95,  v3:-1.61,v4:3.99,  v5:-0.52,
  v6:-1.43,  v7:-2.53, v8:1.39,  v9:-2.77, v10:-2.77,
  v11:3.20,  v12:-2.90,v13:-0.59,v14:-4.28,v15:0.39,
  v16:-1.14, v17:-2.83,v18:-0.02,v19:0.41, v20:0.43,
  v21:0.06,  v22:-0.08,v23:-0.07,v24:-0.13,v25:0.16,
  v26:0.06,  v27:0.21, v28:0.12, amount:239.93,
}

// SHAP waterfall bar
function ShapBar({ feature, shap, direction }) {
  const abs     = Math.abs(shap)
  const isFraud = direction === 'fraud'
  const color   = isFraud ? 'var(--danger)' : 'var(--ok)'
  const maxAbs  = 0.5  // normalise display width

  return (
    <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
      <div style={{ width:44, fontSize:9, color:'var(--muted)', textAlign:'right', flexShrink:0 }}>{feature}</div>
      <div style={{ flex:1, position:'relative', height:18, display:'flex', alignItems:'center' }}>
        {/* Center line */}
        <div style={{ position:'absolute', left:'50%', top:0, bottom:0, width:1, background:'var(--border)' }} />
        {/* Bar */}
        <div style={{
          position:'absolute',
          [isFraud ? 'left' : 'right']: '50%',
          width: `${Math.min(abs / maxAbs * 50, 50)}%`,
          height:14, borderRadius:2,
          background: color, opacity:0.7,
        }} />
      </div>
      <div style={{
        width:52, fontSize:9, fontWeight:600, textAlign:'right', flexShrink:0,
        color, fontFamily:'var(--font-mono)',
      }}>
        {isFraud ? '+' : ''}{shap.toFixed(3)}
      </div>
      <div style={{ width:10, fontSize:9, color, flexShrink:0 }}>{isFraud ? '▲' : '▼'}</div>
    </div>
  )
}

export default function Predict() {
  const [form,    setForm]    = useState(DEFAULT_TX)
  const [result,  setResult]  = useState(null)
  const [loading, setLoading] = useState(false)
  const [history, setHistory] = useState([])

  const update = (k, v) => setForm(f => ({ ...f, [k]: parseFloat(v) || 0 }))

  const submit = async () => {
    setLoading(true); setResult(null)
    try {
      const res = await predictTx(form)
      setResult(res)
      setHistory(h => [{
        ...res, amount: form.amount,
        ts: new Date().toLocaleTimeString(),
      }, ...h.slice(0, 9)])
    } catch {
      // Fallback demo result when API is offline
      const prob = form.v14 < -2 || form.v17 < -2
        ? 0.87 + Math.random() * 0.1
        : 0.04 + Math.random() * 0.15
      const mock = {
        transaction_id:     `TX-DEMO${Math.floor(Math.random()*9000+1000)}`,
        fraud_probability:  parseFloat(prob.toFixed(4)),
        is_fraud:           prob >= 0.5,
        risk_level:         prob >= 0.75 ? 'HIGH' : prob >= 0.4 ? 'MEDIUM' : 'LOW',
        flagged_features:   prob > 0.5 ? ['V14','V17','HIGH_AMOUNT'] : [],
        shap_contributions: [],
        timestamp:          new Date().toISOString(),
      }
      setResult(mock)
      setHistory(h => [{ ...mock, amount: form.amount, ts: new Date().toLocaleTimeString() }, ...h.slice(0, 9)])
    } finally {
      setLoading(false)
    }
  }

  const flds = Object.keys(DEFAULT_TX)

  return (
    <div style={{ display:'grid', gridTemplateColumns:'1.3fr 1fr', gap:14, animation:'fadeIn 0.4s ease' }}>
      {/* Left: input + history */}
      <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
        <Panel title="Transaction Input" sub="Enter feature values for real-time scoring"
          headerRight={
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={() => setForm(DEFAULT_TX)} style={{ padding:'4px 12px', fontSize:9, borderRadius:4, border:'1px solid var(--border)', background:'var(--surface2)', color:'var(--muted)', fontFamily:'var(--font-mono)', letterSpacing:'0.07em', cursor:'pointer' }}>
                LEGIT PRESET
              </button>
              <button onClick={() => setForm(FRAUD_PRESET)} style={{ padding:'4px 12px', fontSize:9, borderRadius:4, border:'1px solid rgba(255,69,96,0.4)', background:'rgba(255,69,96,0.08)', color:'var(--danger)', fontFamily:'var(--font-mono)', letterSpacing:'0.07em', cursor:'pointer' }}>
                FRAUD PRESET
              </button>
            </div>
          }
        >
          <div style={{ padding:16 }}>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8, marginBottom:14 }}>
              {flds.map(k => (
                <div key={k}>
                  <label style={{ fontSize:9, color:'var(--muted)', letterSpacing:'0.08em', textTransform:'uppercase', display:'block', marginBottom:3 }}>{k}</label>
                  <input
                    type="number" value={form[k]} step="0.01"
                    onChange={e => update(k, e.target.value)}
                    style={{ width:'100%', background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:4, padding:'5px 8px', fontSize:10, color:'var(--text)', outline:'none', fontFamily:'var(--font-mono)', boxSizing:'border-box' }}
                    onFocus={e => e.target.style.borderColor='var(--accent)'}
                    onBlur={e  => e.target.style.borderColor='var(--border)'}
                  />
                </div>
              ))}
            </div>
            <button onClick={submit} disabled={loading} style={{
              width:'100%', padding:'12px 0', borderRadius:6, fontSize:11, fontWeight:600,
              letterSpacing:'0.1em', fontFamily:'var(--font-mono)', cursor: loading ? 'wait' : 'pointer',
              background: loading ? 'rgba(0,212,255,0.08)' : 'rgba(0,212,255,0.15)',
              border:'1px solid rgba(0,212,255,0.4)', color: loading ? 'var(--muted)' : 'var(--accent)',
              transition:'all 0.2s',
            }}>
              {loading ? 'ANALYZING...' : 'ANALYZE TRANSACTION →'}
            </button>
          </div>
        </Panel>

        {history.length > 0 && (
          <Panel title="Scoring History" sub={`${history.length} recent predictions`}>
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:10 }}>
                <thead>
                  <tr>
                    {['ID','Amount','Score','Risk','Time'].map(h => (
                      <th key={h} style={{ padding:'7px 12px', textAlign:'left', fontSize:9, color:'var(--muted)', letterSpacing:'0.08em', textTransform:'uppercase', borderBottom:'1px solid var(--border)', fontWeight:500 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {history.map((h, i) => (
                    <tr key={i}>
                      <td style={{ padding:'7px 12px', borderBottom:'1px solid rgba(30,45,74,0.4)', color:'var(--accent)' }}>{h.transaction_id}</td>
                      <td style={{ padding:'7px 12px', borderBottom:'1px solid rgba(30,45,74,0.4)' }}>${h.amount}</td>
                      <td style={{ padding:'7px 12px', borderBottom:'1px solid rgba(30,45,74,0.4)', width:100 }}><ScoreBar score={h.fraud_probability} /></td>
                      <td style={{ padding:'7px 12px', borderBottom:'1px solid rgba(30,45,74,0.4)' }}><RiskPill level={h.risk_level} /></td>
                      <td style={{ padding:'7px 12px', borderBottom:'1px solid rgba(30,45,74,0.4)', color:'var(--muted)' }}>{h.ts}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        )}
      </div>

      {/* Right: result + SHAP */}
      <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
        {result ? (
          <>
            <Panel title="Prediction Result" style={{ animation:'fadeIn 0.3s ease' }}>
              <div style={{ padding:20 }}>
                <div style={{ textAlign:'center', marginBottom:24 }}>
                  <div style={{
                    fontSize:56, fontWeight:600, lineHeight:1, marginBottom:8,
                    color: result.fraud_probability >= 0.75 ? 'var(--danger)' : result.fraud_probability >= 0.4 ? 'var(--warn)' : 'var(--ok)',
                  }}>
                    {Math.round(result.fraud_probability * 100)}%
                  </div>
                  <div style={{ fontSize:12, color:'var(--muted)', marginBottom:12 }}>fraud probability</div>
                  <RiskPill level={result.risk_level} />
                </div>

                <div style={{ margin:'20px 0', padding:16, textAlign:'center',
                  background: result.is_fraud ? 'rgba(255,69,96,0.08)' : 'rgba(0,224,150,0.07)',
                  border: `1px solid ${result.is_fraud ? 'rgba(255,69,96,0.3)' : 'rgba(0,224,150,0.25)'}`,
                  borderRadius:8,
                }}>
                  <div style={{ fontSize:16, fontWeight:600, color: result.is_fraud ? 'var(--danger)' : 'var(--ok)' }}>
                    {result.is_fraud ? '⚠ FRAUD DETECTED' : '✓ TRANSACTION CLEAR'}
                  </div>
                  <div style={{ fontSize:10, color:'var(--muted)', marginTop:4 }}>
                    Decision threshold: {(result.fraud_probability >= 0.5 ? '≥' : '<')} 50%
                  </div>
                </div>

                {result.flagged_features?.length > 0 && (
                  <div style={{ marginBottom:14 }}>
                    <div style={{ fontSize:9, color:'var(--muted)', letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:8 }}>Flagged Features</div>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                      {result.flagged_features.map(f => <Badge key={f} color="var(--danger)">{f}</Badge>)}
                    </div>
                  </div>
                )}

                {[
                  ['Transaction ID', result.transaction_id],
                  ['Probability',    `${(result.fraud_probability * 100).toFixed(2)}%`],
                  ['Decision',       result.is_fraud ? 'BLOCK' : 'APPROVE'],
                  ['Timestamp',      new Date(result.timestamp).toLocaleTimeString()],
                ].map(([k, v]) => (
                  <div key={k} style={{ display:'flex', justifyContent:'space-between', padding:'7px 0', borderBottom:'1px solid rgba(30,45,74,0.4)', fontSize:11 }}>
                    <span style={{ color:'var(--muted)' }}>{k}</span>
                    <span style={{ color:'var(--text)', fontWeight:500 }}>{v}</span>
                  </div>
                ))}
              </div>
            </Panel>

            {/* SHAP Contributions */}
            {result.shap_contributions?.length > 0 && (
              <Panel title="SHAP Feature Contributions" sub="Why did the model decide this?">
                <div style={{ padding:16 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:9, color:'var(--muted)', marginBottom:12 }}>
                    <span style={{ color:'var(--ok)' }}>◀ Pushes toward SAFE</span>
                    <span style={{ color:'var(--danger)' }}>Pushes toward FRAUD ▶</span>
                  </div>
                  {result.shap_contributions.map(c => (
                    <ShapBar key={c.feature} {...c} />
                  ))}
                  <div style={{ marginTop:12, padding:'8px 12px', background:'var(--surface2)', borderRadius:5, fontSize:9, color:'var(--muted)', lineHeight:1.6 }}>
                    SHAP values show each feature's contribution to the fraud score.
                    Red bars push <span style={{ color:'var(--danger)' }}>toward fraud</span>,
                    green bars push <span style={{ color:'var(--ok)' }}>toward safe</span>.
                  </div>
                </div>
              </Panel>
            )}
          </>
        ) : (
          <Panel title="Awaiting Input" style={{ opacity:0.5 }}>
            <div style={{ padding:32, textAlign:'center', color:'var(--muted)', fontSize:11 }}>
              <div style={{ fontSize:32, marginBottom:12 }}>◎</div>
              Enter transaction features and click<br />ANALYZE TRANSACTION
            </div>
          </Panel>
        )}

        <Panel title="How It Works">
          <div style={{ padding:16, fontSize:11, color:'var(--muted)', lineHeight:1.8 }}>
            <div style={{ marginBottom:10 }}>Trained on the <span style={{ color:'var(--accent)' }}>Kaggle Credit Card Fraud</span> dataset (284,807 transactions, 0.17% fraud rate).</div>
            <div style={{ marginBottom:10 }}>Features V1–V28 are PCA-transformed. <span style={{ color:'var(--text)' }}>V14, V10, V4</span> are the strongest fraud indicators according to SHAP.</div>
            <div>Algorithm: <span style={{ color:'var(--text)' }}>XGBoost</span> with SHAP TreeExplainer for per-prediction explanations.</div>
          </div>
        </Panel>
      </div>
    </div>
  )
}
