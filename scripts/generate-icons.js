const fs = require('fs')
const path = require('path')
const sharp = require('sharp')

const publicDir = path.join(__dirname, '..', 'public')
const srcCandidates = ['icon-source.png', 'icon-1024.png', 'icon.png']

async function main() {
  let src = null
  for (const c of srcCandidates) {
    const p = path.join(publicDir, c)
    if (fs.existsSync(p)) { src = p; break }
  }
  if (!src) {
    const svg = Buffer.from('<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg"><rect width="1024" height="1024" fill="#1a1a2e"/><text x="512" y="560" font-size="480" text-anchor="middle" fill="#d97706" font-family="sans-serif">A</text></svg>')
    const placeholder = await sharp(svg).png().toBuffer()
    src = path.join(publicDir, 'icon-source.png')
    fs.writeFileSync(src, placeholder)
  }

  const buf = fs.readFileSync(src)

  // 1024x1024 PNG (macOS high-res)
  const png1024 = await sharp(buf).resize(1024, 1024, { kernel: 'nearest' }).png().toBuffer()
  fs.writeFileSync(path.join(publicDir, 'icon-1024.png'), png1024)

  // 512x512 PNG (Linux, Windows portable)
  const png512 = await sharp(buf).resize(512, 512, { kernel: 'nearest' }).png().toBuffer()
  fs.writeFileSync(path.join(publicDir, 'icon.png'), png512)

  // BMP-based ICO with multiple sizes for maximum NSIS compatibility
  const icoSizes = [16, 32, 48, 64, 128, 256]
  const icoEntries = []

  for (const size of icoSizes) {
    const rgba = await sharp(buf).resize(size, size, { kernel: 'nearest' }).raw().toBuffer()
    // BMP DIB header (BITMAPINFOHEADER v3, 40 bytes)
    const header = Buffer.alloc(40)
    header.writeUInt32LE(40, 0)        // header size
    header.writeInt32LE(size, 4)        // width
    header.writeInt32LE(size * 2, 8)    // height (doubled for ICO mask)
    header.writeUInt16LE(1, 12)         // color planes (must be 1)
    header.writeUInt16LE(32, 14)        // bits per pixel
    header.writeUInt32LE(0, 16)         // compression (BI_RGB)
    header.writeUInt32LE(size * size * 4, 20) // image size
    header.writeInt32LE(0, 24)          // x pixels per meter
    header.writeInt32LE(0, 28)          // y pixels per meter
    header.writeUInt32LE(0, 32)         // colors used
    header.writeUInt32LE(0, 36)         // important colors

    // AND mask (row-aligned to 4 bytes, 1 bit per pixel, all 0x00 for alpha-channel icons)
    const andRowSize = Math.ceil(size / 32) * 4
    const andMask = Buffer.alloc(andRowSize * size, 0x00)

    // BGRA pixel data (swap R and B from raw RGBA)
    const pixels = Buffer.alloc(size * size * 4)
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const srcOff = (y * size + x) * 4
        const dstOff = srcOff
        pixels[dstOff]     = rgba[srcOff + 2] // B
        pixels[dstOff + 1] = rgba[srcOff + 1] // G
        pixels[dstOff + 2] = rgba[srcOff]     // R
        pixels[dstOff + 3] = rgba[srcOff + 3] // A
      }
    }

    const imageData = Buffer.concat([header, pixels, andMask])
    icoEntries.push({ w: size, h: size, data: imageData })
  }

  // Build ICO
  const headerSize = 6
  const dirEntrySize = 16
  let dataOffset = headerSize + icoEntries.length * dirEntrySize
  const icoHeader = Buffer.alloc(headerSize)
  icoHeader.writeUInt16LE(0, 0)                      // reserved
  icoHeader.writeUInt16LE(1, 2)                      // type ICO
  icoHeader.writeUInt16LE(icoEntries.length, 4)       // count

  const dirEntries = []
  const imageParts = []
  for (const entry of icoEntries) {
    // ICONDIRENTRY (16 bytes total)
    const dir = Buffer.alloc(dirEntrySize)
    const w = entry.w >= 256 ? 0 : entry.w
    const h = entry.h >= 256 ? 0 : entry.h
    dir[0] = w                                          // width
    dir[1] = h                                          // height
    dir[2] = 0                                          // colors
    dir[3] = 0                                          // reserved
    dir.writeUInt16LE(1, 4)                             // planes
    dir.writeUInt16LE(32, 6)                            // bits per pixel
    dir.writeUInt32LE(entry.data.length, 8)             // image data size
    dir.writeUInt32LE(dataOffset, 12)                   // offset to image data
    dirEntries.push(dir)
    imageParts.push(entry.data)
    dataOffset += entry.data.length
  }

  const ico = Buffer.concat([icoHeader, ...dirEntries, ...imageParts])
  fs.writeFileSync(path.join(publicDir, 'icon.ico'), ico)

  console.log(`Icons generated: 1024x1024 PNG, 512x512 PNG, ICO (${icoSizes.join('x, ')}x)`)
}

main().catch(console.error)
