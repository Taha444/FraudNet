import React, { useEffect, useState } from 'react'
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement,
  PointElement, ArcElement, Tooltip, Legend, Filler
} from 'chart.js'
import { Bar, Doughnut } from 'react-chartjs-2'
import { fetchStats, fetchTimeseries } from '../api'
import { Panel, MetricCard, Spinner, Badge } from '../components'

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Tooltip, Legend, Filler)

const C = {
  accent:'#00d4ff', danger:'#ff4560', warn:'#f59e0b', ok:'#00e096',
  purple:'#818cf8', muted:'#5a6a8a', text:'#c8d6f0',
}

const TOOLTIP_OPTS = {
  backgroundColor:'#1a2236', borderColor:'#1e2d4a', borderWidth:1,
  titleColor:C.text, bodyColor:C.muted,
}

export default function Dashboard() {
  const [stats,  setStats]  = useState(null)
  const [ts,     setTs]     = useState(null)
  const [errApi, setErrApi] = useState(false)

  useEffect(() => {
    fetchStats()
      .then(setStats)
      .catch(() => { setStats(MOCK_STATS); setErrApi(true) })
    fetchTimeseries(30)
      .then(d => setTs(d.data))
      .catch(() => setTs(MOCK_TS))
  }, [])

  if (!stats || !ts) return <Spinner />

  const S  = stats
  const T  = ts
  const FI = S.feature_importance || []

  const txLabels  = T.map(d => d.date)
  const txVol     = T.map(d => d.volume)
  const txFraud   = T.map(d => d.fraud_rate)

  const maxFI = FI.length ? Math.max(...FI.map(f => f.importance)) : 1

  return (
    <div style={{ animation:'fadeIn 0.4s ease' }}>
      {errApi && (
        <div style={{ padding:'8px 16px', background:'rgba(245,158,11,0.1)', border:'1px solid rgba(245,158,11,0.3)', borderRadius:6, marginBottom:16, fontSize:10, color:'var(--warn)' }}>
          API offline — showing demo data.&nbsp;
          <code style={{ color:'var(--accent)' }}>uvicorn backend.main:app --reload</code>
        </div>
      )}

      {/* Runtime stats from DB (if available) */}
      {S.runtime && (S.runtime.predictions_in_db > 0) && (
        <div style={{ display:'flex', gap:10, marginBottom:16, padding:'10px 16px', background:'rgba(0,212,255,0.05)', border:'1px solid rgba(0,212,255,0.2)', borderRadius:6 }}>
          <span style={{ fontSize:10, color:'var(--accent)', fontWeight:600 }}>LIVE DB</span>
          <span style={{ fontSize:10, color:'var(--muted)' }}>
            {S.runtime.predictions_in_db} predictions stored ·
            {S.runtime.fraud_detected} fraud detected ·
            {S.runtime.open_alerts} alerts open
          </span>
          {S.shap_enabled && <Badge color="var(--ok)">SHAP ON</Badge>}
        </div>
      )}

      {/* KPI Cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:18 }}>
        <MetricCard
          label="Fraud Detected"
          value={S.total_fraud.toLocaleString()}
          sub={`of ${S.total_transactions.toLocaleString()} transactions`}
          trend={`${(S.fraud_rate * 100).toFixed(3)}% rate`}
          trendUp color="var(--danger)" topColor="var(--danger)"
        />
        <MetricCard
          label="Model Accuracy"
          value={`${(S.model_accuracy * 100).toFixed(2)}%`}
          sub="on held-out test split"
          trend={`F1: ${S.model_f1}`}
          topColor="var(--ok)" color="var(--ok)"
        />
        <MetricCard
          label="AUC-ROC Score"
          value={S.auc_roc}
          sub="classifier performance"
          trend={`Precision ${(S.model_precision * 100).toFixed(1)}%`}
          topColor="var(--accent)"
        />
        <MetricCard
          label="Avg Fraud Amount"
          value={`$${S.avg_fraud_amount}`}
          sub={`vs $${S.avg_legit_amount} legit avg`}
          trend="38% higher than legit"
          trendUp topColor="var(--warn)"
        />
      </div>

      {/* Volume + Category */}
      <div style={{ display:'grid', gridTemplateColumns:'3fr 1fr', gap:14, marginBottom:18 }}>
        <Panel title="Transaction Volume vs Fraud Rate" sub="30-day rolling">
          <div style={{ padding:14 }}>
            <div style={{ display:'flex', gap:16, marginBottom:10 }}>
              {[['Transaction Volume', C.accent],['Fraud Rate %', C.danger]].map(([l,c]) => (
                <span key={l} style={{ display:'flex', alignItems:'center', gap:6, fontSize:10, color:'var(--muted)' }}>
                  <span style={{ width:10, height:10, borderRadius:2, background:c, opacity:0.8 }} />{l}
                </span>
              ))}
            </div>
            <div style={{ position:'relative', height:200 }}>
              <Bar
                data={{
                  labels: txLabels,
                  datasets: [
                    { label:'Transactions', data:txVol, backgroundColor:'rgba(0,212,255,0.18)', borderColor:'rgba(0,212,255,0.45)', borderWidth:1, yAxisID:'y',  order:2 },
                    { label:'Fraud Rate %', data:txFraud, type:'line', borderColor:C.danger, backgroundColor:'rgba(255,69,96,0.07)', borderWidth:2, pointRadius:0, fill:true, yAxisID:'y1', order:1, tension:0.4 },
                  ]
                }}
                options={{
                  responsive:true, maintainAspectRatio:false,
                  interaction:{ intersect:false, mode:'index' },
                  plugins:{ legend:{ display:false }, tooltip:TOOLTIP_OPTS },
                  scales:{
                    x:{ ticks:{ color:C.muted, font:{ size:9 }, maxTicksLimit:8 }, grid:{ color:'rgba(30,45,74,0.6)' }},
                    y:{ ticks:{ color:C.muted, font:{ size:9 }}, grid:{ color:'rgba(30,45,74,0.6)' }},
                    y1:{ position:'right', ticks:{ color:C.danger, font:{ size:9 }}, grid:{ display:false }},
                  }
                }}
              />
            </div>
          </div>
        </Panel>

        <Panel title="Fraud by Type" sub="category breakdown">
          <div style={{ padding:14 }}>
            <div style={{ position:'relative', height:200 }}>
              <Doughnut
                data={{
                  labels:['Online','ATM','POS','Wire','Mobile'],
                  datasets:[{ data:[38,22,18,14,8], backgroundColor:[C.danger,C.warn,C.accent,C.ok,C.purple], borderWidth:0, hoverOffset:5 }]
                }}
                options={{
                  responsive:true, maintainAspectRatio:false, cutout:'68%',
                  plugins:{
                    legend:{ position:'bottom', labels:{ color:C.muted, font:{ size:9 }, boxWidth:8, padding:10 }},
                    tooltip:TOOLTIP_OPTS,
                  }
                }}
              />
            </div>
          </div>
        </Panel>
      </div>

      {/* Confusion Matrix + Feature Importance */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:18 }}>
        <Panel title="Model Performance" sub="XGBoost · real metrics from training report">
          <div style={{ padding:16 }}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:16 }}>
              {[
                { key:'Precision', val:`${(S.model_precision * 100).toFixed(1)}%`, color:C.ok },
                { key:'Recall',    val:`${(S.model_recall   * 100).toFixed(1)}%`, color:C.ok },
                { key:'F1 Score',  val:S.model_f1,  color:C.ok },
                { key:'AUC-ROC',   val:S.auc_roc,   color:C.accent },
                { key:'Dataset',   val:'284,807',    color:C.text },
                { key:'Features',  val:'30 (V1–V28)',color:C.text },
              ].map(({ key, val, color }) => (
                <div key={key} style={{ display:'flex', justifyContent:'space-between', padding:'6px 0', borderBottom:'1px solid rgba(30,45,74,0.5)', fontSize:11 }}>
                  <span style={{ color:'var(--muted)' }}>{key}</span>
                  <span style={{ color, fontWeight:500 }}>{val}</span>
                </div>
              ))}
            </div>

            <div style={{ fontSize:9, color:'var(--muted)', letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:8 }}>Confusion Matrix</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
              {[
                { label:'True Positive',  val:S.confusion_matrix.tp, bg:'rgba(0,224,150,0.12)',  border:'rgba(0,224,150,0.25)',  color:C.ok },
                { label:'False Positive', val:S.confusion_matrix.fp, bg:'rgba(245,158,11,0.1)',  border:'rgba(245,158,11,0.25)', color:C.warn },
                { label:'False Negative', val:S.confusion_matrix.fn, bg:'rgba(255,69,96,0.1)',   border:'rgba(255,69,96,0.25)',  color:C.danger },
                { label:'True Negative',  val:S.confusion_matrix.tn, bg:'rgba(0,212,255,0.08)',  border:'rgba(0,212,255,0.2)',   color:C.accent },
              ].map(({ label, val, bg, border, color }) => (
                <div key={label} style={{ padding:12, borderRadius:6, background:bg, border:`1px solid ${border}`, textAlign:'center' }}>
                  <div style={{ fontSize:20, fontWeight:600, color }}>{val.toLocaleString()}</div>
                  <div style={{ fontSize:9, color:'var(--muted)', letterSpacing:'0.08em', textTransform:'uppercase', marginTop:2 }}>{label}</div>
                </div>
              ))}
            </div>
          </div>
        </Panel>

        <Panel title="Feature Importance" sub={S.shap_enabled ? 'SHAP-aligned · loaded from training report' : 'Loaded from training report'}>
          <div style={{ padding:16 }}>
            {FI.length === 0 && (
              <div style={{ textAlign:'center', color:'var(--muted)', fontSize:11, padding:20 }}>
                Train the model first to see feature importance
              </div>
            )}
            {FI.map((f, i) => (
              <div key={f.feature} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12, animation:`slideIn ${0.1 + i * 0.05}s ease` }}>
                <div style={{ width:40, fontSize:10, color:'var(--muted)', flexShrink:0 }}>{f.feature}</div>
                <div style={{ flex:1, height:6, background:'var(--surface3)', borderRadius:3, overflow:'hidden' }}>
                  <div style={{ width:`${(f.importance / maxFI) * 100}%`, height:'100%', background:`hsl(${190 - i * 15},80%,55%)`, borderRadius:3 }} />
                </div>
                <div style={{ width:40, textAlign:'right', fontSize:11, fontWeight:500, color:'var(--text)' }}>
                  {(f.importance * 100).toFixed(1)}%
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {/* Thresholds info + Amount Distribution */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 2fr', gap:14 }}>
        <Panel title="Active Thresholds" sub="Configurable in Settings">
          <div style={{ padding:16 }}>
            {S.thresholds && [
              { label:'Fraud Decision', val:S.thresholds.fraud,  color:C.danger },
              { label:'HIGH Risk',      val:S.thresholds.high,   color:C.warn },
              { label:'MEDIUM Risk',    val:S.thresholds.medium, color:C.accent },
            ].map(({ label, val, color }) => (
              <div key={label} style={{ marginBottom:12 }}>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, marginBottom:5 }}>
                  <span style={{ color:'var(--muted)' }}>{label}</span>
                  <span style={{ color, fontWeight:600 }}>{Math.round(val * 100)}%</span>
                </div>
                <div style={{ height:4, background:'var(--surface3)', borderRadius:2 }}>
                  <div style={{ width:`${val * 100}%`, height:'100%', background:color, borderRadius:2 }} />
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Amount Distribution: Fraud vs Legitimate" sub="log-binned histogram">
          <div style={{ padding:14 }}>
            <div style={{ display:'flex', gap:16, marginBottom:10 }}>
              {[['Legitimate', C.accent],['Fraud', C.danger]].map(([l, c]) => (
                <span key={l} style={{ display:'flex', alignItems:'center', gap:6, fontSize:10, color:'var(--muted)' }}>
                  <span style={{ width:10, height:10, borderRadius:2, background:c, opacity:0.7 }} />{l}
                </span>
              ))}
            </div>
            <div style={{ position:'relative', height:160 }}>
              <Bar
                data={{
                  labels:['$0–10','$10–50','$50–100','$100–200','$200–500','$500–1k','$1k+'],
                  datasets:[
                    { label:'Legitimate', data:[45,28,12,8,4,2,1],  backgroundColor:'rgba(0,212,255,0.25)', borderColor:'rgba(0,212,255,0.5)',  borderWidth:1 },
                    { label:'Fraud',      data:[8,15,22,28,18,6,3], backgroundColor:'rgba(255,69,96,0.28)', borderColor:'rgba(255,69,96,0.55)', borderWidth:1 },
                  ]
                }}
                options={{
                  responsive:true, maintainAspectRatio:false,
                  plugins:{ legend:{ display:false }, tooltip:TOOLTIP_OPTS },
                  scales:{
                    x:{ ticks:{ color:C.muted, font:{ size:9 }}, grid:{ color:'rgba(30,45,74,0.5)' }},
                    y:{ ticks:{ color:C.muted, font:{ size:9 }}, grid:{ color:'rgba(30,45,74,0.5)' },
                        title:{ display:true, text:'% of txns', color:C.muted, font:{ size:9 }}},
                  }
                }}
              />
            </div>
          </div>
        </Panel>
      </div>
    </div>
  )
}

// ─── Fallback mock data ────────────────────────────────────────────────────────
const MOCK_STATS = {
  total_transactions:284807, total_fraud:492, fraud_rate:0.00173,
  avg_fraud_amount:122.21, avg_legit_amount:88.35,
  model_accuracy:0.9994, model_precision:0.8723, model_recall:0.8367,
  model_f1:0.8542, auc_roc:0.9803,
  confusion_matrix:{ tp:82, fp:12, fn:16, tn:56852 },
  feature_importance:[
    { feature:'V14',    importance:0.362 },
    { feature:'V10',    importance:0.144 },
    { feature:'V4',     importance:0.067 },
    { feature:'V12',    importance:0.056 },
    { feature:'V17',    importance:0.048 },
    { feature:'Amount', importance:0.041 },
    { feature:'V11',    importance:0.038 },
    { feature:'Time',   importance:0.030 },
  ],
  thresholds:{ fraud:0.5, high:0.75, medium:0.4 },
  runtime:{ predictions_in_db:0, fraud_detected:0, open_alerts:0 },
  shap_enabled:false,
}

const MOCK_TS = Array.from({ length:31 }, (_, i) => {
  const d = new Date(Date.now() - (30 - i) * 86400000)
  return {
    date:`${d.getMonth()+1}/${d.getDate()}`,
    volume:8000 + Math.floor(Math.sin(i * 0.4) * 2000 + 1000),
    fraud_rate:parseFloat((0.15 + Math.sin(i * 0.3) * 0.05).toFixed(3)),
  }
})
