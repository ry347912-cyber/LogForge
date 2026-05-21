import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
})

// Attach JWT token from localStorage to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('logforge_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Handle 401 - redirect to login
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('logforge_token')
      localStorage.removeItem('logforge_user')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export default api

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const authApi = {
  login: (username, password) => api.post('/auth/login', { username, password }),
  me: () => api.get('/auth/me'),
  listUsers: () => api.get('/auth/users'),
  createUser: (data) => api.post('/auth/users', data),
}

// ─── Logs ─────────────────────────────────────────────────────────────────────
export const logsApi = {
  list: (params) => api.get('/logs/', { params }),
  recent: (limit = 20) => api.get('/logs/recent', { params: { limit } }),
  get: (id) => api.get(`/logs/${id}`),
  anomalies: (limit = 50) => api.get('/logs/anomalies', { params: { limit } }),
  analyze: (queryText, hours = 1) => api.post('/logs/analyze', null, { params: { query_text: queryText, hours } }),
  exportCsv: (params) => api.get('/logs/export/csv', { params, responseType: 'blob' }),
}

// ─── Alerts ───────────────────────────────────────────────────────────────────
export const alertsApi = {
  list: (params) => api.get('/alerts/', { params }),
  active: () => api.get('/alerts/active'),
  get: (id) => api.get(`/alerts/${id}`),
  resolve: (id) => api.post(`/alerts/${id}/resolve`),
  analyze: (id) => api.post(`/alerts/${id}/analyze`),
  create: (data) => api.post('/alerts/', data),
}

// ─── Analytics ────────────────────────────────────────────────────────────────
export const analyticsApi = {
  overview: (hours = 24) => api.get('/analytics/overview', { params: { hours } }),
  timeline: (hours = 24, interval = 60) => api.get('/analytics/timeline', { params: { hours, interval_minutes: interval } }),
  topIps: (hours = 24) => api.get('/analytics/top-ips', { params: { hours } }),
  severity: (hours = 24) => api.get('/analytics/severity-distribution', { params: { hours } }),
  sources: (hours = 24) => api.get('/analytics/sources', { params: { hours } }),
  checkIp: (ip) => api.get(`/analytics/ip-check/${ip}`),
}

// ─── Ingestion ────────────────────────────────────────────────────────────────
export const ingestApi = {
  single: (data) => api.post('/ingest/single', data),
  bulk: (data) => api.post('/ingest/bulk', data),
  upload: (formData) => api.post('/ingest/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  stats: () => api.get('/ingest/stats'),
}

// ─── System ───────────────────────────────────────────────────────────────────
export const systemApi = {
  health: () => api.get('/system/health'),
  sources: () => api.get('/system/sources'),
}
