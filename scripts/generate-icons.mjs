import sharp from 'sharp'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const svgPath = path.join(__dirname, '..', 'public', 'icons', 'icon.svg')
const svg = readFileSync(svgPath)

const sizes = [16, 32, 48, 128]

for (const size of sizes) {
  const outPath = path.join(__dirname, '..', 'public', 'icons', `icon${size}.png`)
  await sharp(svg, { density: 384 })
    .resize(size, size)
    .png()
    .toFile(outPath)
  console.log(`generated ${outPath}`)
}
