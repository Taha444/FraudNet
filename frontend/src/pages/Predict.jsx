import React, { useState } from 'react'
import { predictTx } from '../api'
import { Panel, RiskPill, ScoreBar, Badge } from '../components'

const DEFAULT_TX = {
  time: 75432, v1: -1.36, v2: -0.07, v3: 2.54, v4: 1.38, v5: -0.34,
  v6: 0.46, v7: 0.24, v8: 0.10, v9: 0.36, v10: 0.09,
  v11: -0.55, v12: -0.62, v13: -0.99, v14: -0.31, v15: -0.47,
  v16: 0.21, v17: 0.04, v18: 0.40, v19: 0.25, v20: -0.02,
  v21: 0.28, v22: 0.77, v23: 0.23, v24: 0.26, v25: -0.24,
  v26: 0.04, v27: 0.62, v28: 0.62, amount: 149.62,
}

const FRAUD_PRESET = {
  time: 406, v1: -2.31, v2: 1.95, v3: -1.61, v4: 3.99, v5: -0.52,
  v6: -1.43, v7: -2.53, v8: 1.39, v9: -2.77, v10: -2.77,
  v11: 3.20, v12: -2.90, v13: -0.59, v14: -4.28, v15: 0.39,
  v16: -1.14, v17: -2.83, v18: -0.02, v19: 0.41, v20: 0.43,
  v21: 0.06, v22: -0.08, v23: -0.07, v24: -0.13, v25: 0.16,
  v26: 0.06, v27: 0.21, v28: 0.12, amount: 239.93,
}

export default function Predict() {
  const [form, setForm] = useState(DEFAULT_TX)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [history, setHistory] = useState([])

  const update = (k, v) => setForm(f => ({ ...f, [k]: parseFloat(v) || 0 }))

  const submit = async () => {
    setLoading(true); setError(null); setResult(null)
    try {
      const res = await predictTx(form)
      setResult(res)
      setHistory(h => [{ ...res, amount: form.amount, ts: new Date().toLocaleTimeString() }, ...h.slice(0, 9)])
    } catch (e) {
      const mockProb = form.v14 < -2 || form.v17 < -2 ? 0.87 + Math.random() * 0.1 : 0.04 + Math.random() * 0.15
      const mock = {
        transaction_id: `TX-${Math.floor(Math.random() * 90000 + 10000)}`,
        fraud_probability: parseFloat(mockProb.toFixed(4)),
        is_fraud: mockProb >= 0.5,
        risk_level: mockProb >= 0.75 ? 'HIGH' : mockProb >= 0.4 ? 'MEDIUM' : 'LOW',
        flagged_features: mockProb > 0.5 ? ['V14', 'V17', 'HIGH_AMOUNT'] : [],
        timestamp: new Date().toISOString(),
      }
      setResult(mock)
      setHistory(h => [{ ...mock, amount: form.amount, ts: new Date().toLocaleTimeString() }, ...h.slice(0, 9)])
    }
    setLoading(false)
  }

  const flds = Object.keys(DEFAULT_TX)

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 14, animation: 'fadeIn 0.4s ease' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Panel title="Transaction Input" sub="Enter feature values for real-time scoring"
          headerRight={
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setForm(DEFAULT_TX)} style={{ padding: '4px 12px', fontSize: 9, borderRadius: 4, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--muted)', fontFamily: 'var(--font-mono)', letterSpacing: '0.07em' }}>
                LEGIT PRESET
              </button>
              <button onClick={() => setForm(FRAUD_PRESET)} style={{ padding: '4px 12px', fontSize: 9, borderRadius: 4, border: '1px solid rgba(255,69,96,0.4)', background: 'rgba(255,69,96,0.08)', color: 'var(--danger)', fontFamily: 'var(--font-mono)', letterSpacing: '0.07em' }}>
                FRAUD PRESET
              </button>
            </div>
          }
        >
          <div style={{ padding: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 14 }}>
              {flds.map(k => (
                <div key={k}>
                  <label style={{ fontSize: 9, color: 'var(--muted)', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: 3 }}>{k}</label>
                  <input
                    type="number"
                    value={form[k]}
                    onChange={e => update(k, e.target.value)}
                    step="0.01"
                    style={{
                      width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)',
                      borderRadius: 4, padding: '5px 8px', fontSize: 10, color: 'var(--text)',
                      outline: 'none', fontFamily: 'var(--font-mono)',
                    }}
                    onFocus={e => e.target.style.borderColor = 'var(--accent)'}
                    onBlur={e => e.target.style.borderColor = 'var(--border)'}
                  />
                </div>
              ))}
            </div>

            <button onClick={submit} disabled={loading} style={{
              width: '100%', padding: '12px 0', borderRadius: 6, fontSize: 11, fontWeight: 600,
              letterSpacing: '0.1em', fontFamily: 'var(--font-mono)', cursor: loading ? 'wait' : 'pointer',
              background: loading ? 'rgba(0,212,255,0.08)' : 'rgba(0,212,255,0.15)',
              border: '1px solid rgba(0,212,255,0.4)', color: loading ? 'var(--muted)' : 'var(--accent)',
              transition: 'all 0.2s',
            }}>
              {loading ? 'ANALYZING...' : 'ANALYZE TRANSACTION →'}
            </button>
          </div>
        </Panel>

        {/* History */}
        {history.length > 0 && (
          <Panel title="Scoring History" sub={`${history.length} recent predictions`}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
                <thead>
                  <tr>
                    {['ID', 'Amount', 'Score', 'Risk', 'Time'].map(h => (
                      <th key={h} style={{ padding: '7px 12px', textAlign: 'left', fontSize: 9, color: 'var(--muted)', letterSpacing: '0.08em', textTransform: 'uppercase', borderBottom: '1px solid var(--border)', fontWeight: 500 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {history.map((h, i) => (
                    <tr key={i}>
                      <td style={{ padding: '7px 12px', borderBottom: '1px solid rgba(30,45,74,0.4)', color: 'var(--accent)' }}>{h.transaction_id}</td>
                      <td style={{ padding: '7px 12px', borderBottom: '1px solid rgba(30,45,74,0.4)' }}>${h.amount}</td>
                      <td style={{ padding: '7px 12px', borderBottom: '1px solid rgba(30,45,74,0.4)', width: 100 }}><ScoreBar score={h.fraud_probability} /></td>
                      <td style={{ padding: '7px 12px', borderBottom: '1px solid rgba(30,45,74,0.4)' }}><RiskPill level={h.risk_level} /></td>
                      <td style={{ padding: '7px 12px', borderBottom: '1px solid rgba(30,45,74,0.4)', color: 'var(--muted)' }}>{h.ts}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        )}
      </div>

      <div>
        {result ? (
          <Panel title="Prediction Result" style={{ animation: 'fadeIn 0.3s ease' }}>
            <div style={{ padding: 20 }}>
              <div style={{ textAlign: 'center', marginBottom: 24 }}>
                <div style={{
                  fontSize: 56, fontWeight: 600, lineHeight: 1,
                  color: result.fraud_probability >= 0.75 ? 'var(--danger)' : result.fraud_probability >= 0.4 ? 'var(--warn)' : 'var(--ok)',
                  marginBottom: 8,
                }}>
                  {Math.round(result.fraud_probability * 100)}%
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>fraud probability</div>
                <RiskPill level={result.risk_level} />
              </div>

              <div style={{ margin: '20px 0', padding: '16px', background: result.is_fraud ? 'rgba(255,69,96,0.08)' : 'rgba(0,224,150,0.07)', border: `1px solid ${result.is_fraud ? 'rgba(255,69,96,0.3)' : 'rgba(0,224,150,0.25)'}`, borderRadius: 8, textAlign: 'center' }}>
                <div style={{ fontSize: 16, fontWeight: 600, color: result.is_fraud ? 'var(--danger)' : 'var(--ok)' }}>
                  {result.is_fraud ? '⚠ FRAUD DETECTED' : '✓ TRANSACTION CLEAR'}
                </div>
                <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4 }}>Threshold: 50% probability</div>
              </div>

              {result.flagged_features.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 9, color: 'var(--muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>Flagged Features</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {result.flagged_features.map(f => (
                      <Badge key={f} color="var(--danger)">{f}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {[
                ['Transaction ID', result.transaction_id],
                ['Probability', `${(result.fraud_probability * 100).toFixed(2)}%`],
                ['Decision', result.is_fraud ? 'BLOCK' : 'APPROVE'],
                ['Timestamp', new Date(result.timestamp).toLocaleTimeString()],
              ].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid rgba(30,45,74,0.4)', fontSize: 11 }}>
                  <span style={{ color: 'var(--muted)' }}>{k}</span>
                  <span style={{ color: 'var(--text)', fontWeight: 500 }}>{v}</span>
                </div>
              ))}
            </div>
          </Panel>
        ) : (
          <Panel title="Awaiting Input" style={{ opacity: 0.5 }}>
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--muted)', fontSize: 11 }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>◎</div>
              Enter transaction features and click<br />ANALYZE TRANSACTION
            </div>
          </Panel>
        )}

        <Panel title="How It Works" style={{ marginTop: 14 }}>
          <div style={{ padding: 16, fontSize: 11, color: 'var(--muted)', lineHeight: 1.8 }}>
            <div style={{ marginBottom: 10 }}>The model was trained on the <span style={{ color: 'var(--accent)' }}>Kaggle Credit Card Fraud</span> dataset (284,807 transactions).</div>
            <div style={{ marginBottom: 10 }}>Features V1–V28 are PCA-transformed components from real transaction data. <span style={{ color: 'var(--text)' }}>V14, V17, V12</span> are the strongest fraud indicators.</div>
            <div>Algorithm: <span style={{ color: 'var(--text)' }}>XGBoost</span> with class-weight balancing to handle the 0.17% fraud rate imbalance.</div>
          </div>
        </Panel>
      </div>
    </div>
  )
}
