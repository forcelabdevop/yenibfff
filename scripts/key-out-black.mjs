// Siyah zeminli ürün görsellerinden alfa kanalı üretir.
// Alfa = pikselin en parlak kanalı, böylece parlayan hız çizgileri
// yumuşak biçimde saydamlaşır ve kart zeminine doğal şekilde oturur.
import sharp from "sharp"

const JOBS = [
  { src: "frontend/public/promo/dice-src.png", out: "frontend/public/promo/dice-3d.png" },
  { src: "frontend/public/promo/ball-src.png", out: "frontend/public/promo/ball-3d.png" },
]

// Bu eşiğin altındaki parlaklık tamamen saydam sayılır (sensör gürültüsünü temizler).
const FLOOR = 18

for (const { src, out } of JOBS) {
  const image = sharp(src).ensureAlpha()
  const { width, height } = await image.metadata()
  const raw = await image.raw().toBuffer()

  for (let i = 0; i < raw.length; i += 4) {
    const brightest = Math.max(raw[i], raw[i + 1], raw[i + 2])
    const alpha = brightest <= FLOOR ? 0 : Math.min(255, Math.round(((brightest - FLOOR) / (255 - FLOOR)) * 340))
    raw[i + 3] = alpha
  }

  await sharp(raw, { raw: { width, height, channels: 4 } })
    .trim({ threshold: 1 })
    .png()
    .toFile(out)

  console.log(`[v0] wrote ${out}`)
}
