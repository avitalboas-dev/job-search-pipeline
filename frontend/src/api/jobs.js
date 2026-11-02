const BASE = '/api'

const UNREACHABLE_ERROR = 'Could not reach the server. Check that the backend is running.'

const TOKEN_KEY = 'crm_token'

function authHeaders() {
  const token = sessionStorage.getItem(TOKEN_KEY)
  return token ? { Authorization: `Bearer ${token}` } : {}
}

// Expired or invalid token: drop it and reload so the password screen shows
function handleUnauthorized() {
  sessionStorage.removeItem(TOKEN_KEY)
  window.location.reload()
}

async function request(path, options = {}) {
  let res
  try {
    res = await fetch(`${BASE}${path}`, {
      headers: { 'Content-Type': 'application/json', ...authHeaders(), ...options.headers },
      ...options,
    })
  } catch {
    throw new Error(UNREACHABLE_ERROR)
  }
  if (res.status === 401) handleUnauthorized()
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || 'Request failed')
  }
  if (res.status === 204) return null
  return res.json()
}

export const api = {
  // Resolves true if the stored token (or no password, locally) is accepted
  checkAuth: async () => {
    try {
      const res = await fetch(`${BASE}/auth/check`, { headers: authHeaders() })
      return res.ok
    } catch {
      return false
    }
  },
  login: async (password) => {
    let res
    try {
      res = await fetch(`${BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
    } catch {
      throw new Error(UNREACHABLE_ERROR)
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }))
      throw new Error(err.detail || 'Request failed')
    }
    const { token } = await res.json()
    sessionStorage.setItem(TOKEN_KEY, token)
  },
  listJobs: () => request('/jobs/'),
  getJob: (id) => request(`/jobs/${id}`),
  createJob: (data) => request('/jobs/', { method: 'POST', body: JSON.stringify(data) }),
  updateJob: (id, data) => request(`/jobs/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteJob: (id) => request(`/jobs/${id}`, { method: 'DELETE' }),
  extractJob: (url) => request('/extract/', { method: 'POST', body: JSON.stringify({ url }) }),
  extractJobDocument: async (file) => {
    const formData = new FormData()
    formData.append('file', file)
    let res
    try {
      res = await fetch(`${BASE}/extract/document`, { method: 'POST', headers: authHeaders(), body: formData })
    } catch {
      throw new Error(UNREACHABLE_ERROR)
    }
    if (res.status === 401) handleUnauthorized()
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }))
      throw new Error(err.detail || 'Request failed')
    }
    return res.json()
  },
}
