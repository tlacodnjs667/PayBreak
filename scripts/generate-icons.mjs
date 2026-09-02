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
  const artworkSize = size === 128 ? 96 : size
  const padding = (size - artworkSize) / 2
  let image = sharp(svg, { density: 384 }).resize(artworkSize, artworkSize)
  if (padding > 0) {
    image = image.extend({
      top: padding,
      bottom: padding,
      left: padding,
      right: padding,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
  }
  await image.png().toFile(outPath)
  console.log(`generated ${outPath}`)
}
