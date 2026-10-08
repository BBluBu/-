const { writeFileSync } = require('node:fs')
const { join } = require('node:path')
const { deflateSync } = require('node:zlib')

const size = 256
const pixels = Buffer.alloc(size * size * 4)

function withinRoundedSquare(x, y) {
  const dx = Math.max(Math.abs(x - 128) - 68, 0)
  const dy = Math.max(Math.abs(y - 128) - 68, 0)
  return dx * dx + dy * dy < 52 * 52
}

for (let y = 0; y < size; y++) {
  for (let x = 0; x < size; x++) {
    let coverage = 0
    let white = 0
    for (const offsetY of [0.25, 0.75]) {
      for (const offsetX of [0.25, 0.75]) {
        const sx = x + offsetX
        const sy = y + offsetY
        if (!withinRoundedSquare(sx, sy)) continue
        coverage++
        const dx = sx - 128
        const dy = sy - 128
        const radius = Math.hypot(dx, dy)
        if (radius > 52 && radius < 78 && !(dx > 28 && Math.abs(dy) < 33)) white++
      }
    }
    const index = (y * size + x) * 4
    const amount = white / Math.max(coverage, 1)
    pixels[index] = Math.round((49 + 3 * y / size) * (1 - amount) + 255 * amount)
    pixels[index + 1] = Math.round((132 - 42 * y / size) * (1 - amount) + 255 * amount)
    pixels[index + 2] = Math.round((214 - 27 * y / size) * (1 - amount) + 255 * amount)
    pixels[index + 3] = Math.round(coverage * 255 / 4)
  }
}

function crc32(data) {
  let crc = 0xffffffff
  for (const byte of data) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit++) crc = crc >>> 1 ^ (crc & 1 ? 0xedb88320 : 0)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const label = Buffer.from(type)
  const header = Buffer.alloc(4)
  header.writeUInt32BE(data.length)
  const checksum = Buffer.alloc(4)
  checksum.writeUInt32BE(crc32(Buffer.concat([label, data])))
  return Buffer.concat([header, label, data, checksum])
}

const scanlines = Buffer.alloc(size * (size * 4 + 1))
for (let y = 0; y < size; y++) pixels.copy(scanlines, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4)
const header = Buffer.alloc(13)
header.writeUInt32BE(size, 0)
header.writeUInt32BE(size, 4)
header[8] = 8
header[9] = 6
const png = Buffer.concat([
  Buffer.from('89504e470d0a1a0a', 'hex'),
  chunk('IHDR', header),
  chunk('IDAT', deflateSync(scanlines)),
  chunk('IEND', Buffer.alloc(0))
])

const icoHeader = Buffer.alloc(22)
icoHeader.writeUInt16LE(1, 2)
icoHeader.writeUInt16LE(1, 4)
icoHeader.writeUInt16LE(1, 10)
icoHeader.writeUInt16LE(32, 12)
icoHeader.writeUInt32LE(png.length, 14)
icoHeader.writeUInt32LE(22, 18)
writeFileSync(join(__dirname, '../resources/app.ico'), Buffer.concat([icoHeader, png]))
