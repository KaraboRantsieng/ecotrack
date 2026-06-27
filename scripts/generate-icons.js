// Run once: node scripts/generate-icons.js
import sharp from 'sharp'
import { mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SRC = join(__dirname, '../public/logo.png')
const OUT = join(__dirname, '../public/icons')
mkdirSync(OUT, { recursive: true })

for (const size of [192, 512]) {
  await sharp(SRC)
    .resize(size, size, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .png()
    .toFile(join(OUT, `icon-${size}.png`))
  console.log(`✓ icon-${size}.png`)
}

// Also generate apple-touch-icon (180x180)
await sharp(SRC)
  .resize(180, 180, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
  .png()
  .toFile(join(__dirname, '../public/apple-touch-icon.png'))
console.log('✓ apple-touch-icon.png')

console.log('Done.')
