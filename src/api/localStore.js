// Production SDK — all data lives in SQLite via the backend API.
// Auth → /api/auth/*   |   Entities → /api/entities/*
// Files → /api/upload  |   AI → /api/ai

// ─── Helpers ────────────────────────────────────────────────────────────────

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = e => resolve(e.target.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

async function urlToBase64(url) {
  if (url.startsWith('data:')) {
    const [header, data] = url.split(',')
    return { data, media_type: header.match(/data:([^;]+)/)?.[1] || 'image/jpeg' }
  }
  const r = await fetch(url)
  const blob = await r.blob()
  const dataUrl = await fileToDataUrl(blob)
  const [header, data] = dataUrl.split(',')
  return { data, media_type: blob.type || header.match(/data:([^;]+)/)?.[1] || 'image/jpeg' }
}

function buildMockAIResponse(schema) {
  const mock = {}
  if (schema?.properties) {
    for (const [key, s] of Object.entries(schema.properties)) {
      if (s.enum) mock[key] = s.enum[0]
      else if (s.type === 'number') mock[key] = 0
      else if (s.type === 'boolean') mock[key] = false
      else mock[key] = null
    }
  }
  if ('category' in mock) mock.category = 'other'
  if ('confidence' in mock) mock.confidence = 0
  if ('weight_kg' in mock) mock.weight_kg = 1.0
  if ('condition' in mock) mock.condition = 'not_working'
  if ('description' in mock) mock.description = 'AI not configured — add VITE_ANTHROPIC_API_KEY to .env'
  if ('quantity' in mock) mock.quantity = 1
  if ('item_name' in mock) mock.item_name = ''
  if ('item_specs' in mock) mock.item_specs = ''
  if ('serial_number' in mock) mock.serial_number = null
  if ('identifier_type' in mock) mock.identifier_type = null
  if ('found' in mock) mock.found = false
  return mock
}

async function apiFetch(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    credentials: 'same-origin',
    ...options,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
    const e = new Error(err.error || `HTTP ${res.status}`)
    e.status = res.status
    throw e
  }
  return res.json()
}

// ─── Entity store (server-backed) ───────────────────────────────────────────

class EntityStore {
  constructor(name) { this.name = name }

  async list(sort) {
    const params = sort ? `?sort=${encodeURIComponent(sort)}` : ''
    return apiFetch(`/api/entities/${this.name}${params}`)
  }

  async filter(conditions = {}, sort, limit) {
    const params = new URLSearchParams()
    if (Object.keys(conditions).length) params.set('filter', JSON.stringify(conditions))
    if (sort) params.set('sort', sort)
    if (limit != null) params.set('limit', String(limit))
    return apiFetch(`/api/entities/${this.name}?${params}`)
  }

  async create(data) {
    return apiFetch(`/api/entities/${this.name}`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async update(id, data) {
    return apiFetch(`/api/entities/${this.name}/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
  }

  async delete(id) {
    return apiFetch(`/api/entities/${this.name}/${id}`, { method: 'DELETE' })
  }
}

// ─── Auth (server-backed) ────────────────────────────────────────────────────

class ServerAuth extends EntityStore {
  constructor() { super('User') }

  async me() {
    return apiFetch('/api/auth/me')
  }

  async updateMe(data) {
    const user = await this.me()
    return this.update(user.id, data)
  }

  async login({ email, password }) {
    return apiFetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
  }

  async register(userData) {
    return apiFetch('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    })
  }

  async googleLogin(credential) {
    return apiFetch('/api/auth/google', {
      method: 'POST',
      body: JSON.stringify({ credential }),
    })
  }

  async logout(redirectUrl) {
    await apiFetch('/api/auth/logout', { method: 'POST' }).catch(() => {})
    window.location.href = redirectUrl || '/'
  }

  redirectToLogin() {
    window.dispatchEvent(new CustomEvent('ecotrack:show-login'))
  }
}

// ─── Integrations ────────────────────────────────────────────────────────────

const Core = {
  async InvokeLLM({ prompt, file_urls = [], response_json_schema } = {}) {
    try {
      const content = []
      for (const url of file_urls) {
        try {
          const { data, media_type } = await urlToBase64(url)
          content.push({ type: 'image', source: { type: 'base64', media_type, data } })
        } catch (imgErr) {
          console.warn('[SDK] Could not load image for AI:', url, imgErr.message)
        }
      }
      content.push({ type: 'text', text: prompt })

      const system = response_json_schema
        ? `You must respond with ONLY a valid JSON object — no markdown, no code blocks, no explanation text outside the JSON.\nSchema: ${JSON.stringify(response_json_schema)}`
        : 'Be concise and accurate.'

      const result = await apiFetch('/api/ai', {
        method: 'POST',
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 1024,
          system,
          messages: [{ role: 'user', content }],
        }),
      })

      const text = (result.content?.[0]?.text || '').trim()
      try {
        return JSON.parse(text)
      } catch {
        const match = text.match(/\{[\s\S]*\}/)
        if (match) return JSON.parse(match[0])
        throw new Error(`AI returned non-JSON: "${text.slice(0, 120)}…"`)
      }
    } catch (e) {
      if (e.message?.includes('not configured') || e.status === 503) {
        console.warn('[SDK] AI not configured — using placeholder response.')
        return buildMockAIResponse(response_json_schema)
      }
      throw e
    }
  },

  async UploadFile({ file }) {
    if (!file) throw new Error('No file provided')
    const dataUrl = await fileToDataUrl(file)
    const [, data] = dataUrl.split(',')
    try {
      return await apiFetch('/api/upload', {
        method: 'POST',
        body: JSON.stringify({ filename: file.name, data }),
      })
    } catch (e) {
      console.warn('[SDK] Upload failed — using data URL fallback:', e.message)
      return { file_url: dataUrl }
    }
  },

  async SendEmail(params) { console.warn('[SDK] SendEmail not available.', params); return { success: false } },
  async SendSMS(params) { console.warn('[SDK] SendSMS not available.', params); return { success: false } },
  async GenerateImage(params) { console.warn('[SDK] GenerateImage not available.', params); return { url: null } },
  async ExtractDataFromUploadedFile(params) { console.warn('[SDK] ExtractDataFromUploadedFile not available.', params); return {} },
}

// ─── Entity proxy ────────────────────────────────────────────────────────────

const auth = new ServerAuth()
const _cache = {}
const entities = new Proxy(
  { User: auth },
  {
    get(target, name) {
      if (name in target) return target[name]
      if (!_cache[name]) _cache[name] = new EntityStore(name)
      return _cache[name]
    },
  }
)

const appLogs = { logUserInApp: async () => {} }

export const localClient = { auth, entities, integrations: { Core }, appLogs }
