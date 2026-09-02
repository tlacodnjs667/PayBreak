import { spawnSync } from 'node:child_process'
import { access, mkdir, readFile, rm } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const distDir = path.join(projectRoot, 'dist')
const releaseDir = path.join(projectRoot, 'release')
const packageJson = JSON.parse(await readFile(path.join(projectRoot, 'package.json'), 'utf8'))
const archivePath = path.join(releaseDir, `paybreak-${packageJson.version}.zip`)

await access(path.join(distDir, 'manifest.json')).catch(() => {
  throw new Error('dist/manifest.json이 없습니다. 먼저 npm run build를 실행하세요.')
})

await mkdir(releaseDir, { recursive: true })
await rm(archivePath, { force: true })

const zip = spawnSync('zip', ['-r', '-q', archivePath, '.'], {
  cwd: distDir,
  stdio: 'inherit',
})

if (zip.error) {
  throw zip.error
}
if (zip.status !== 0) {
  throw new Error(`zip 명령이 종료 코드 ${zip.status}로 실패했습니다.`)
}

console.log(path.relative(projectRoot, archivePath))

