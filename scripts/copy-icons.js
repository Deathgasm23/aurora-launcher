const fs = require('fs')
const path = require('path')

const files = ['icon.png', 'icon.ico']
const dests = ['dist-electron/electron', 'dist']

for (const dest of dests) {
  for (const file of files) {
    const src = path.join('public', file)
    const dst = path.join(dest, file)
    if (fs.existsSync(src)) {
      fs.mkdirSync(path.dirname(dst), { recursive: true })
      fs.copyFileSync(src, dst)
    }
  }
}
