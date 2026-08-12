import axios from 'axios'

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const WS_BASE = BASE.replace(/^http/, 'ws')

// ── Auth token storage ────────────────────────────────────────────────────────
export const auth = {
  getToken:  ()      => localStorage.getItem('fraudnet_token'),
  getUser:   ()      => { try { return JSON.parse(localStorage.getItem('fraudnet_user')) } catch { return null } },
  setSession:(token, user) => {
    localStorage.setItem('fraudnet_token', token)
    localStorage.setItem('fraudnet_user', JSON.stringify(user))
  },
  clear:     ()      => {
    localStorage.removeItem('fraudnet_token')
    localStorage.removeItem('fraudnet_user')
  },
  isAdmin:   ()      => auth.getUser()?.role === 'admin',
  isAnalyst: ()      => ['admin','analyst'].includes(auth.getUser()?.role),
}

// ── Axios instance ────────────────────────────────────────────────────────────
const api = axios.create({ baseURL: BASE, timeout: 15000 })

// Attach JWT to every request
api.interceptors.request.use(cfg => {
  const token = auth.getToken()
  if (token) cfg.headers.Authorization = `Bearer ${token}`
  return cfg
})

// Auto-logout on 401
api.interceptors.response.use(
  r => r,
  err => {
    if (err.response?.status === 401) {
      auth.clear()
      window.dispatchEvent(new Event('fraudnet:logout'))
    }
    return Promise.reject(err)
  }
)

// ── Auth endpoints ────────────────────────────────────────────────────────────
export const login = (username, password) => {
  const form = new URLSearchParams()
  form.append('username', username)
  form.append('password', password)
  return api.post('/api/auth/token', form, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  }).then(r => r.data)
}

export const fetchMe = () => api.get('/api/auth/me').then(r => r.data)

export const registerUser = (payload) => api.post('/api/auth/register', payload).then(r => r.data)

export const changePassword = (current_password, new_password) =>
  api.post('/api/auth/change-password', { current_password, new_password }).then(r => r.data)

// Admin-only recovery path for a locked-out user
export const resetUserPassword = (username, new_password) =>
  api.post(`/api/auth/users/${encodeURIComponent(username)}/reset-password`,
           { new_password }).then(r => r.data)

// ── Core data endpoints ───────────────────────────────────────────────────────
export const fetchStats      = ()            => api.get('/api/stats').then(r => r.data)
export const fetchTimeseries = (days = 30)   => api.get(`/api/timeseries?days=${days}`).then(r => r.data)
export const fetchRecent     = (limit = 30, risk = null) => {
  const params = { limit }
  if (risk) params.risk = risk
  return api.get('/api/transactions/recent', { params }).then(r => r.data)
}
export const predictTx       = (tx)          => api.post('/api/predict', tx).then(r => r.data)
export const predictBatch    = (txs)         => api.post('/api/predict/batch', { transactions: txs }).then(r => r.data)
export const health          = ()            => api.get('/api/health').then(r => r.data)

// ── Alerts ────────────────────────────────────────────────────────────────────
export const fetchAlerts      = (status = null) => {
  const params = status ? { status_filter: status } : {}
  return api.get('/api/alerts', { params }).then(r => r.data)
}
export const updateAlertStatus = (alertId, status) =>
  api.put(`/api/alerts/${alertId}/status`, { status }).then(r => r.data)

// ── Thresholds ────────────────────────────────────────────────────────────────
export const fetchThresholds  = ()      => api.get('/api/thresholds').then(r => r.data)
export const saveThresholds   = (body)  => api.put('/api/thresholds', body).then(r => r.data)

// ── Audit log ─────────────────────────────────────────────────────────────────
export const fetchAuditLog = (limit = 100) =>
  api.get(`/api/audit?limit=${limit}`).then(r => r.data)

// ── WebSocket factory ─────────────────────────────────────────────────────────
export const createAlertsSocket = (onMessage, onClose) => {
  const token = auth.getToken()
  const url   = `${WS_BASE}/ws/alerts${token ? `?token=${token}` : ''}`
  const ws    = new WebSocket(url)

  ws.onmessage = e => {
    try { onMessage(JSON.parse(e.data)) } catch {}
  }
  ws.onclose   = () => onClose && onClose()
  ws.onerror   = () => ws.close()

  // Keep-alive ping every 25 s
  const ping = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) ws.send('ping')
  }, 25000)
  ws.addEventListener('close', () => clearInterval(ping))

  return ws
}

export default api
