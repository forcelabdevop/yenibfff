import sharp from "sharp"

/**
 * Yeşil ekran (chroma key) arka planını saydama çevirir.
 * Yeşil baskın pikseller tamamen saydam yapılır, kenarlardaki yeşil saçaklar
 * yumuşatılır ve karakterdeki yeşil yansıma nötrlenir (despill).
 */
const src = "frontend/public/banners/mascot-src.png"
const out = "frontend/public/banners/mascot.png"

const img = sharp(src).ensureAlpha()
const { width, height } = await img.metadata()
const buf = await img.raw().toBuffer()

for (let i = 0; i < buf.length; i += 4) {
  const r = buf[i]
  const g = buf[i + 1]
  const b = buf[i + 2]

  // Yeşilin diğer kanallara olan baskınlığı: yüksekse arka plandır.
  const dominance = g - Math.max(r, b)

  if (dominance > 60) {
    buf[i + 3] = 0
  } else if (dominance > 12) {
    // Kenar geçişi: yumuşak alfa rampası ile testere dişini önler.
    buf[i + 3] = Math.round(255 * (1 - (dominance - 12) / 48))
  }

  // Despill: kalan pikseldeki fazla yeşili komşu kanallara indir.
  if (buf[i + 3] > 0 && dominance > 0) {
    buf[i + 1] = Math.round(Math.max(r, b) + Math.min(dominance, 6))
  }
}

await sharp(buf, { raw: { width, height, channels: 4 } })
  .png()
  .trim({ threshold: 1 })
  .toFile(out)

const meta = await sharp(out).metadata()
console.log("[v0] mascot.png", meta.width, "x", meta.height)
