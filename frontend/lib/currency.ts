import type { FiatCode } from "./types"

export interface FiatMeta {
  code: FiatCode
  symbol: string
  /** Intl.NumberFormat için */
  locale: string
  /**
   * Backend POST /wallet/convert-to-fiat kabul listesinde var mı? Bu route
   * şu an bozuk (backend/routes/wallet.js → User.balance.data'ya bakıyor,
   * gerçek şema User.wallets[] — çağrıldığında her zaman hata döner), bu
   * yüzden bugün hiçbir fiat gerçekten "desteklenmiyor". Bilgi amaçlı tutuluyor.
   */
  supportedByBackend: boolean
}

/**
 * Görüntüleme para birimleri.
 * Backend'in kabul listesi: backend/routes/wallet.js → `supported`
 * GBP henüz o listede yok; EU açılışında backend'e eklenmeli.
 */
export const FIATS: Record<FiatCode, FiatMeta> = {
  EUR: { code: "EUR", symbol: "€", locale: "de-DE", supportedByBackend: true },
  USD: { code: "USD", symbol: "$", locale: "en-US", supportedByBackend: true },
  GBP: { code: "GBP", symbol: "£", locale: "en-GB", supportedByBackend: false },
  TRY: { code: "TRY", symbol: "₺", locale: "tr-TR", supportedByBackend: true },
  BRL: { code: "BRL", symbol: "R$", locale: "pt-BR", supportedByBackend: true },
  INR: { code: "INR", symbol: "₹", locale: "en-IN", supportedByBackend: true },
  IDR: { code: "IDR", symbol: "Rp", locale: "id-ID", supportedByBackend: true },
  RUB: { code: "RUB", symbol: "₽", locale: "ru-RU", supportedByBackend: true },
  JPY: { code: "JPY", symbol: "¥", locale: "ja-JP", supportedByBackend: true },
  CNY: { code: "CNY", symbol: "¥", locale: "zh-CN", supportedByBackend: true },
}

/** EU pazarında kasada gösterilecek fiat sırası. */
export const EU_FIAT_ORDER: FiatCode[] = ["EUR", "GBP", "USD"]

export function formatFiat(amount: number, fiat: FiatCode): string {
  const meta = FIATS[fiat] ?? FIATS.EUR
  return new Intl.NumberFormat(meta.locale, {
    style: "currency",
    currency: meta.code,
    minimumFractionDigits: meta.code === "JPY" ? 0 : 2,
    maximumFractionDigits: meta.code === "JPY" ? 0 : 2,
  }).format(Number.isFinite(amount) ? amount : 0)
}

/** Crash vb. oyunlarda çarpan gösterimi — backend x100 ölçekte tutar. */
export function formatMultiplier(scaledValue: number): string {
  return `${(scaledValue / 100).toFixed(2)}x`
}
