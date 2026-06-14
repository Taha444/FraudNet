import axios from 'axios'

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const api = axios.create({ baseURL: BASE, timeout: 10000 })

export const fetchStats    = ()            => api.get('/api/stats').then(r => r.data)
export const fetchTimeseries = (days = 30) => api.get(`/api/timeseries?days=${days}`).then(r => r.data)
export const fetchRecent   = (limit = 20, risk = null) => {
  const params = { limit }
  if (risk) params.risk = risk
  return api.get('/api/transactions/recent', { params }).then(r => r.data)
}
export const predictTx     = (tx)          => api.post('/api/predict', tx).then(r => r.data)
export const health        = ()            => api.get('/api/health').then(r => r.data)

export default api
