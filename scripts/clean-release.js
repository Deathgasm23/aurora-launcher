const fs = require('fs')
const path = require('path')

const releaseDir = path.join(__dirname, '..', process.env.RELEASE_DIR || 'release-build')
const keep = process.env.KEEP || '.exe,.AppImage,.dmg,.yml'

const keepExts = keep.split(',').map(s => s.trim().toLowerCase())

function clean(dir) {
  if (!fs.existsSync(dir)) return
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry)
    const stat = fs.statSync(full)
    if (stat.isDirectory()) {
      fs.rmSync(full, { recursive: true, force: true })
    } else {
      const ext = path.extname(entry).toLowerCase()
      if (!keepExts.includes(ext)) {
        fs.rmSync(full, { force: true })
      }
    }
  }
}

clean(releaseDir)
