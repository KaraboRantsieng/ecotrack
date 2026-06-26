import { createServer } from 'http'
import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from 'fs'
import { extname, join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { randomUUID, randomBytes, scrypt, timingSafeEqual } from 'crypto'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const Database = require('better-sqlite3')

// ── Load .env ─────────────────────────────────────────────────────────────────
try {
  const envFile = readFileSync('.env', 'utf8')
  for (const line of envFile.split('\n')) {
    const [key, ...rest] = line.trim().split('=')
    if (key && !key.startsWith('#') && !process.env[key]) {
      process.env[key] = rest.join('=').replace(/^["']|["']$/g, '')
    }
  }
} catch { /* no .env */ }

const __dirname = dirname(fileURLToPath(import.meta.url))
const PORT = process.env.PORT || 3000
const DIST = join(__dirname, 'dist')
const UPLOADS = process.env.UPLOADS_DIR || join(__dirname, 'uploads')
const DATA_DIR = process.env.DATA_DIR   || join(__dirname, 'data')
mkdirSync(UPLOADS, { recursive: true })
mkdirSync(DATA_DIR, { recursive: true })

// ── SQLite ────────────────────────────────────────────────────────────────────
const db = new Database(join(DATA_DIR, 'ecotrack.db'))
db.pragma('journal_mode = WAL')
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id           TEXT PRIMARY KEY,
    email        TEXT UNIQUE NOT NULL,
    full_name    TEXT,
    role         TEXT DEFAULT 'collector',
    area         TEXT DEFAULT '',
    created_date TEXT,
    password_hash TEXT,
    google_id    TEXT,
    extra        TEXT DEFAULT '{}'
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token      TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS entities (
    id          TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    data        TEXT NOT NULL,
    created_date TEXT,
    PRIMARY KEY (id, entity_type)
  );
`)
// Migrate existing DBs that predate these columns
;['password_hash TEXT', 'google_id TEXT'].forEach(col => {
  try { db.exec(`ALTER TABLE users ADD COLUMN ${col}`) } catch { /* already exists */ }
})

// ── Password helpers ──────────────────────────────────────────────────────────
function hashPassword(password) {
  return new Promise((resolve, reject) => {
    const salt = randomBytes(16).toString('hex')
    scrypt(password, salt, 64, (err, derived) => {
      err ? reject(err) : resolve(`${salt}:${derived.toString('hex')}`)
    })
  })
}

function verifyPassword(password, stored) {
  return new Promise((resolve, reject) => {
    const [salt, key] = stored.split(':')
    scrypt(password, salt, 64, (err, derived) => {
      if (err) return reject(err)
      try { resolve(timingSafeEqual(derived, Buffer.from(key, 'hex'))) }
      catch { resolve(false) }
    })
  })
}

// ── Misc helpers ──────────────────────────────────────────────────────────────
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'application/javascript',
  '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.json': 'application/json',
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let d = ''
    req.on('data', c => (d += c))
    req.on('end', () => resolve(d))
    req.on('error', reject)
  })
}

function json(res, status, data) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(data))
}

function parseCookies(req) {
  const out = {}
  ;(req.headers.cookie || '').split(';').forEach(pair => {
    const [k, ...v] = pair.trim().split('=')
    if (k) out[k.trim()] = v.join('=')
  })
  return out
}

function getSession(req) {
  const token = parseCookies(req)['ecotrack_session']
  if (!token) return null
  const row = db.prepare('SELECT * FROM sessions WHERE token = ?').get(token)
  if (!row) return null
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(row.user_id)
  return user ? { token, user } : null
}

function userToObj(u) {
  const extra = JSON.parse(u.extra || '{}')
  return {
    id: u.id, email: u.email, full_name: u.full_name,
    role: u.role, area: u.area, created_date: u.created_date,
    has_password: !!u.password_hash, has_google: !!u.google_id,
    ...extra
  }
}

function createSession(userId) {
  const token = randomBytes(32).toString('hex')
  db.prepare('INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)').run(token, userId, Date.now())
  return token
}

function setSessionCookie(res, token) {
  res.setHeader('Set-Cookie', `ecotrack_session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=2592000`)
}

// ── HTTP server ───────────────────────────────────────────────────────────────
const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`)
  const { pathname } = url

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    res.statusCode = 204; res.end(); return
  }

  // ── POST /api/auth/register ─────────────────────────────────────────────
  if (req.method === 'POST' && pathname === '/api/auth/register') {
    try {
      const { email, password, full_name, role = 'collector', area = '' } = JSON.parse(await readBody(req))
      if (!email || !password || !full_name) return json(res, 400, { error: 'Name, email and password are required' })
      if (password.length < 6) return json(res, 400, { error: 'Password must be at least 6 characters' })
      if (db.prepare('SELECT id FROM users WHERE email = ?').get(email)) {
        return json(res, 409, { error: 'An account with this email already exists' })
      }
      const id = randomUUID()
      const password_hash = await hashPassword(password)
      db.prepare(
        'INSERT INTO users (id, email, full_name, role, area, created_date, password_hash, extra) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(id, email, full_name, role, area, new Date().toISOString(), password_hash, '{}')
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id)
      const token = createSession(id)
      setSessionCookie(res, token)
      json(res, 200, userToObj(user))
    } catch (e) { json(res, 500, { error: e.message }) }
    return
  }

  // ── POST /api/auth/login ────────────────────────────────────────────────
  if (req.method === 'POST' && pathname === '/api/auth/login') {
    try {
      const { email, password } = JSON.parse(await readBody(req))
      if (!email || !password) return json(res, 400, { error: 'Email and password are required' })
      const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email)
      if (!user || !user.password_hash) return json(res, 401, { error: 'Invalid email or password' })
      const ok = await verifyPassword(password, user.password_hash)
      if (!ok) return json(res, 401, { error: 'Invalid email or password' })
      const token = createSession(user.id)
      setSessionCookie(res, token)
      json(res, 200, userToObj(user))
    } catch (e) { json(res, 500, { error: e.message }) }
    return
  }

  // ── POST /api/auth/google ───────────────────────────────────────────────
  if (req.method === 'POST' && pathname === '/api/auth/google') {
    const clientId = process.env.VITE_GOOGLE_CLIENT_ID
    if (!clientId) return json(res, 503, { error: 'Google login not configured — add VITE_GOOGLE_CLIENT_ID to .env' })
    try {
      const { credential } = JSON.parse(await readBody(req))
      if (!credential) return json(res, 400, { error: 'No credential provided' })

      // Verify the Google ID token
      const tokenInfo = await fetch(
        `https://oauth2.googleapis.com/tokeninfo?id_token=${credential}`
      ).then(r => r.json())

      if (tokenInfo.error_description || tokenInfo.aud !== clientId) {
        return json(res, 401, { error: 'Invalid Google token' })
      }

      const { email, name, sub: googleId } = tokenInfo
      let user = db.prepare('SELECT * FROM users WHERE email = ?').get(email)

      if (!user) {
        const id = randomUUID()
        db.prepare(
          'INSERT INTO users (id, email, full_name, role, area, created_date, google_id, extra) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        ).run(id, email, name || email, 'collector', '', new Date().toISOString(), googleId, '{}')
        user = db.prepare('SELECT * FROM users WHERE id = ?').get(id)
      } else if (!user.google_id) {
        db.prepare('UPDATE users SET google_id = ? WHERE id = ?').run(googleId, user.id)
        user = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id)
      }

      const token = createSession(user.id)
      setSessionCookie(res, token)
      // Flag new Google users so frontend can show profile completion
      json(res, 200, { ...userToObj(user), needs_profile: !user.area })
    } catch (e) { json(res, 500, { error: e.message }) }
    return
  }

  // ── GET /api/auth/me ────────────────────────────────────────────────────
  if (req.method === 'GET' && pathname === '/api/auth/me') {
    const session = getSession(req)
    if (!session) return json(res, 401, { error: 'Not authenticated' })
    json(res, 200, userToObj(session.user))
    return
  }

  // ── POST /api/auth/logout ───────────────────────────────────────────────
  if (req.method === 'POST' && pathname === '/api/auth/logout') {
    const token = parseCookies(req)['ecotrack_session']
    if (token) db.prepare('DELETE FROM sessions WHERE token = ?').run(token)
    res.setHeader('Set-Cookie', 'ecotrack_session=; Path=/; Max-Age=0')
    json(res, 200, { ok: true })
    return
  }

  // ── /api/entities/* ─────────────────────────────────────────────────────
  if (pathname.startsWith('/api/entities/')) {
    const session = getSession(req)
    if (!session) return json(res, 401, { error: 'Not authenticated' })

    const parts = pathname.split('/').filter(Boolean)
    const entityType = parts[2]
    const entityId = parts[3]

    if (entityType === 'User') {
      if (req.method === 'GET') {
        json(res, 200, db.prepare('SELECT * FROM users').all().map(userToObj)); return
      }
      if (req.method === 'PATCH' && entityId) {
        try {
          const data = JSON.parse(await readBody(req))
          const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(entityId)
          if (!existing) return json(res, 404, { error: 'User not found' })
          const { full_name, role, area, email: _e, id: _i, created_date: _cd,
                  has_password: _hp, has_google: _hg, ...extra } = data
          const mergedExtra = { ...JSON.parse(existing.extra || '{}'), ...extra }
          db.prepare('UPDATE users SET full_name=?, role=?, area=?, extra=? WHERE id=?').run(
            full_name ?? existing.full_name, role ?? existing.role,
            area ?? existing.area, JSON.stringify(mergedExtra), entityId
          )
          json(res, 200, userToObj(db.prepare('SELECT * FROM users WHERE id = ?').get(entityId)))
        } catch (e) { json(res, 500, { error: e.message }) }
        return
      }
      return json(res, 405, { error: 'Method not allowed' })
    }

    if (req.method === 'GET') {
      const sort = url.searchParams.get('sort') || '-created_date'
      const filterParam = url.searchParams.get('filter')
      const limit = url.searchParams.get('limit')
      let rows = db.prepare('SELECT data FROM entities WHERE entity_type = ?').all(entityType)
        .map(r => JSON.parse(r.data))
      if (filterParam) {
        const conditions = JSON.parse(filterParam)
        rows = rows.filter(item => Object.entries(conditions).every(([k, v]) => item[k] === v))
      }
      if (sort) {
        const desc = sort.startsWith('-'), key = desc ? sort.slice(1) : sort
        rows.sort((a, b) => {
          const av = a[key] ?? '', bv = b[key] ?? ''
          return desc ? (bv > av ? 1 : bv < av ? -1 : 0) : (av > bv ? 1 : av < bv ? -1 : 0)
        })
      }
      if (limit) rows = rows.slice(0, parseInt(limit))
      json(res, 200, rows); return
    }

    if (req.method === 'POST') {
      try {
        const data = JSON.parse(await readBody(req))
        const id = data.id || randomUUID()
        const now = new Date().toISOString()
        const record = { created_date: now, ...data, id }
        db.prepare('INSERT OR REPLACE INTO entities (id, entity_type, data, created_date) VALUES (?, ?, ?, ?)').run(
          id, entityType, JSON.stringify(record), now
        )
        json(res, 200, record)
      } catch (e) { json(res, 500, { error: e.message }) }
      return
    }

    if (req.method === 'PATCH' && entityId) {
      try {
        const data = JSON.parse(await readBody(req))
        const row = db.prepare('SELECT data FROM entities WHERE id = ? AND entity_type = ?').get(entityId, entityType)
        if (!row) return json(res, 404, { error: 'Not found' })
        const merged = { ...JSON.parse(row.data), ...data, updated_date: new Date().toISOString() }
        db.prepare('UPDATE entities SET data = ? WHERE id = ? AND entity_type = ?').run(JSON.stringify(merged), entityId, entityType)
        json(res, 200, merged)
      } catch (e) { json(res, 500, { error: e.message }) }
      return
    }

    if (req.method === 'DELETE' && entityId) {
      db.prepare('DELETE FROM entities WHERE id = ? AND entity_type = ?').run(entityId, entityType)
      json(res, 200, { ok: true }); return
    }

    json(res, 405, { error: 'Method not allowed' }); return
  }

  // ── POST /api/upload ────────────────────────────────────────────────────
  if (req.method === 'POST' && pathname === '/api/upload') {
    const session = getSession(req)
    if (!session) return json(res, 401, { error: 'Not authenticated' })
    try {
      const { filename = 'file.jpg', data } = JSON.parse(await readBody(req))
      const ext = (filename.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
      const name = `${Date.now()}-${randomBytes(6).toString('hex')}.${ext}`
      writeFileSync(join(UPLOADS, name), Buffer.from(data, 'base64'))
      json(res, 200, { file_url: `/uploads/${name}` })
    } catch (e) { json(res, 500, { error: e.message }) }
    return
  }

  // ── POST /api/ai ────────────────────────────────────────────────────────
  if (req.method === 'POST' && pathname === '/api/ai') {
    const apiKey = process.env.VITE_ANTHROPIC_API_KEY
    if (!apiKey) return json(res, 503, { error: 'AI not configured — add VITE_ANTHROPIC_API_KEY to .env' })
    try {
      const body = await readBody(req)
      const upstream = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body,
      })
      json(res, upstream.status, await upstream.json())
    } catch (e) { json(res, 502, { error: e.message }) }
    return
  }

  // ── GET /uploads/* ──────────────────────────────────────────────────────
  if (pathname.startsWith('/uploads/')) {
    const filePath = join(UPLOADS, pathname.slice(9))
    if (existsSync(filePath) && !statSync(filePath).isDirectory()) {
      res.setHeader('Content-Type', MIME[extname(filePath).toLowerCase()] || 'application/octet-stream')
      res.end(readFileSync(filePath)); return
    }
    res.statusCode = 404; res.end('Not found'); return
  }

  // ── Static files ────────────────────────────────────────────────────────
  let filePath = join(DIST, pathname)
  if (!existsSync(filePath) || statSync(filePath).isDirectory()) filePath = join(DIST, 'index.html')
  if (!existsSync(filePath)) { res.statusCode = 404; res.end('Not found'); return }
  res.setHeader('Content-Type', MIME[extname(filePath).toLowerCase()] || 'application/octet-stream')
  res.end(readFileSync(filePath))
})

server.listen(PORT, () => {
  console.log(`\n✅ EcoTrack running at http://localhost:${PORT}\n`)
  if (!process.env.VITE_ANTHROPIC_API_KEY) console.warn('⚠️  AI disabled — set VITE_ANTHROPIC_API_KEY in .env\n')
  if (!process.env.VITE_GOOGLE_CLIENT_ID) console.warn('⚠️  Google login disabled — set VITE_GOOGLE_CLIENT_ID in .env\n')
})
