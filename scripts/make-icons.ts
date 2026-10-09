// Renders the favicon (green rounded square + dark check) to the PNGs the PWA manifest and iOS need. Node stdlib only.
// Run: npx tsx scripts/make-icons.ts  → public/icon-192.png, icon-512.png, icon-maskable-512.png, apple-touch-icon.png
import { mkdirSync, writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'

const BG = [0x3f, 0xb9, 0x50] as const
const INK = [0x0f, 0x12, 0x17] as const
// favicon geometry in a 16-unit box
const CHECK: [number, number][] = [
  [4, 8.5],
  [6.5, 11],
  [12, 5],
]
const STROKE = 2

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
function crc32(buf: Buffer): number {
  let c = 0xffffffff
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff]! ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}
function png(size: number, rgba: Uint8Array): Buffer {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr.set([8, 6, 0, 0, 0], 8) // 8-bit RGBA, no interlace
  const raw = Buffer.alloc((size * 4 + 1) * size)
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0 // filter: none
    raw.set(rgba.subarray(y * size * 4, (y + 1) * size * 4), y * (size * 4 + 1) + 1)
  }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])
}

function distToSegment(px: number, py: number, [ax, ay]: [number, number], [bx, by]: [number, number]): number {
  const dx = bx - ax
  const dy = by - ay
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
}

/** `rounded`: favicon-style corners; otherwise full bleed with the check shrunk into the maskable safe zone. */
function render(size: number, rounded: boolean): Buffer {
  const SS = 4 // supersamples per axis, for anti-aliased edges
  const out = new Uint8Array(size * size * 4)
  const scale = 16 / size
  const inset = rounded ? 0 : 0.1 // maskable: keep the mark inside the central 80%
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let cover = 0
      let ink = 0
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const u = (x + (sx + 0.5) / SS) * scale
          const v = (y + (sy + 0.5) / SS) * scale
          // rounded rect, radius 4 in the 16-unit box
          const cx = Math.min(Math.max(u, 4), 12)
          const cy = Math.min(Math.max(v, 4), 12)
          if (rounded && Math.hypot(u - cx, v - cy) > 4) continue
          cover++
          const mu = (u - 8) / (1 - 2 * inset) + 8
          const mv = (v - 8) / (1 - 2 * inset) + 8
          const d = Math.min(distToSegment(mu, mv, CHECK[0]!, CHECK[1]!), distToSegment(mu, mv, CHECK[1]!, CHECK[2]!))
          if (d <= STROKE / 2) ink++
        }
      }
      const n = SS * SS
      const i = (y * size + x) * 4
      for (let c = 0; c < 3; c++) out[i + c] = cover ? Math.round((BG[c]! * (cover - ink) + INK[c]! * ink) / cover) : 0
      out[i + 3] = Math.round((cover / n) * 255)
    }
  }
  return png(size, out)
}

mkdirSync('public', { recursive: true })
writeFileSync('public/icon-192.png', render(192, true))
writeFileSync('public/icon-512.png', render(512, true))
writeFileSync('public/icon-maskable-512.png', render(512, false))
// iOS applies its own corner mask, so the touch icon is full bleed
writeFileSync('public/apple-touch-icon.png', render(180, false))
console.log('wrote public/icon-192.png, icon-512.png, icon-maskable-512.png, apple-touch-icon.png')
