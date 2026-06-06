const { execSync } = require('child_process')
const path = require('path')
const fs = require('fs')

const basedir = path.join(__dirname, '..')
const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
const outDir = `release-${ts}`
const releaseDir = path.join(basedir, 'release-build')
const buildDir = path.join(basedir, outDir)

// Build renderer + electron
execSync('npm run build', { stdio: 'inherit', cwd: basedir })

// Create temp config overriding output directory
const pkg = JSON.parse(fs.readFileSync(path.join(basedir, 'package.json'), 'utf-8'))
const buildConfig = { ...pkg.build, directories: { ...pkg.build.directories, output: outDir } }
fs.writeFileSync(path.join(basedir, 'electron-builder.json'), JSON.stringify(buildConfig, null, 2))

try {
  execSync('npx electron-builder --win --config electron-builder.json', { stdio: 'inherit', cwd: basedir })
} finally {
  try { fs.unlinkSync(path.join(basedir, 'electron-builder.json')) } catch {}
}

// Copy to release-build
if (fs.existsSync(releaseDir)) {
  try { fs.rmSync(releaseDir, { recursive: true, force: true }) } catch {}
}
fs.cpSync(buildDir, releaseDir, { recursive: true })

// Clean old timestamped dirs
for (const entry of fs.readdirSync(basedir)) {
  if (/^release-\d{4}-\d{2}-\d{2}T/.test(entry) && entry !== outDir) {
    try { fs.rmSync(path.join(basedir, entry), { recursive: true, force: true }) } catch {}
  }
}
