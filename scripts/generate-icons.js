// Run once: node scripts/generate-icons.js
// Generates PNG icons for the PWA manifest using only Node built-ins.

import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = join(__dirname, '../public/icons')
mkdirSync(OUT, { recursive: true })

// Minimal PNG writer — writes a solid-color square with rounded look via pixel math
function createPNG(size, bgColor, fgPoints) {
  const { r: br, g: bg, b: bb } = bgColor
  const pixels = new Uint8Array(size * size * 4)

  const radius = size * 0.2

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4
      // Rounded rect
      const cx = Math.min(x, size - 1 - x), cy = Math.min(y, size - 1 - y)
      const inCorner = cx < radius && cy < radius
      const dist = inCorner ? Math.sqrt((cx - radius) ** 2 + (cy - radius) ** 2) : 0
      const inside = !inCorner || dist <= radius

      if (inside) {
        pixels[idx] = br; pixels[idx + 1] = bg; pixels[idx + 2] = bb; pixels[idx + 3] = 255
      } else {
        pixels[idx] = 255; pixels[idx + 1] = 255; pixels[idx + 2] = 255; pixels[idx + 3] = 0
      }
    }
  }

  // Draw simple recycle arrows (white) as a proxy — just a centered white circle
  const cx = size / 2, cy = size / 2, r = size * 0.28
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2)
      if (d >= r * 0.55 && d <= r) {
        const idx = (y * size + x) * 4
        if (pixels[idx + 3] === 255) {
          pixels[idx] = 255; pixels[idx + 1] = 255; pixels[idx + 2] = 255
        }
      }
    }
  }

  return toPNG(pixels, size, size)
}

// --- Tiny PNG encoder (no deps) ---
function toPNG(rgba, w, h) {
  const crc32 = (() => {
    const t = new Int32Array(256)
    for (let i = 0; i < 256; i++) {
      let c = i
      for (let k = 0; k < 8; k++) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      t[i] = c
    }
    return (d, buf) => {
      let c = d
      for (const b of buf) c = t[(c ^ b) & 0xff] ^ (c >>> 8)
      return c
    }
  })()

  const deflate = (data) => {
    // zlib level-0 (no compression) — valid for PNG
    const out = []
    out.push(0x78, 0x01)
    const BSIZE = 65535
    for (let i = 0; i < data.length; i += BSIZE) {
      const chunk = data.slice(i, i + BSIZE)
      const last = i + BSIZE >= data.length ? 1 : 0
      out.push(last, chunk.length & 0xff, (chunk.length >> 8) & 0xff, (~chunk.length) & 0xff, ((~chunk.length) >> 8) & 0xff)
      out.push(...chunk)
    }
    // Adler32
    let s1 = 1, s2 = 0
    for (const b of data) { s1 = (s1 + b) % 65521; s2 = (s2 + s1) % 65521 }
    out.push((s2 >> 8) & 0xff, s2 & 0xff, (s1 >> 8) & 0xff, s1 & 0xff)
    return out
  }

  const u32be = n => [(n >> 24) & 0xff, (n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff]

  const chunk = (type, data) => {
    const t = [...type].map(c => c.charCodeAt(0))
    const crc = crc32(0xffffffff, [...t, ...data]) ^ 0xffffffff
    return [...u32be(data.length), ...t, ...data, ...u32be(crc)]
  }

  // Scanlines: filter byte 0 + RGBA per row
  const raw = []
  for (let y = 0; y < h; y++) {
    raw.push(0)
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      raw.push(rgba[i], rgba[i + 1], rgba[i + 2], rgba[i + 3])
    }
  }

  const sig = [137, 80, 78, 71, 13, 10, 26, 10]
  const ihdr = chunk('IHDR', [...u32be(w), ...u32be(h), 8, 6, 0, 0, 0])
  const idat = chunk('IDAT', deflate(raw))
  const iend = chunk('IEND', [])

  return Buffer.from([...sig, ...ihdr, ...idat, ...iend])
}

const green = { r: 5, g: 150, b: 105 } // #059669

for (const size of [192, 512]) {
  const buf = createPNG(size, green)
  writeFileSync(join(OUT, `icon-${size}.png`), buf)
  console.log(`✓ icon-${size}.png`)
}
console.log('Icons written to public/icons/')
