import { backendUrl } from "./config"

/**
 * Sistem özellik envanteri — backend/routes/index.js ve backend/sockets/index.js
 * taranarak çıkarıldı. Tasarım örneği gelene kadar bu liste, hangi özelliklerin
 * canlı backend'e bağlı olduğunu görmek için kullanılıyor.
 */

export type FeatureKind = "rest" | "socket-namespace" | "socket-event"

export interface FeatureSpec {
  id: string
  label: string
  kind: FeatureKind
  /** rest: gerçek backend route path'i · socket-namespace: Namespace anahtarı */
  target: string
  /** rest testlerinde kullanılacak HTTP metodu — çoğu router kökte sadece POST tanımlar */
  method?: "GET" | "POST"
  /** socket-event testlerinde dinlenecek event adı */
  event?: string
  /** Kimlik doğrulama gerektirir (401 bekleniyor demektir, "korumalı" say) */
  authRequired?: boolean
  /**
   * Bu route boş/geçersiz body ile 404 döndürse bile route'un kendisi canlıdır
   * (örn. affiliate/login → "Kullanıcı bulunamadı" 404'ü uygulama seviyesi bir
   * yanıttır, Express'in "route yok" 404'ü değil).
   */
  notFoundIsLive?: boolean
  group: string
}

export const FEATURE_GROUPS = [
  "Oyunlar",
  "Sosyal (Rain / Vault / Chat)",
  "Kasiyer",
  "Ödeme sağlayıcıları",
  "Program & Sadakat",
  "İçerik & Sistem",
] as const

export const FEATURES: FeatureSpec[] = [
  // ---- Oyunlar (socket namespace) ----
  { id: "crash", label: "Crash", kind: "socket-namespace", target: "crash", group: "Oyunlar" },
  { id: "mines", label: "Mines", kind: "socket-namespace", target: "mines", group: "Oyunlar", authRequired: true },
  { id: "towers", label: "Towers", kind: "socket-namespace", target: "towers", group: "Oyunlar", authRequired: true },
  { id: "roll", label: "Roll", kind: "socket-namespace", target: "roll", group: "Oyunlar" },
  { id: "blackjack", label: "Blackjack", kind: "socket-namespace", target: "blackjack", group: "Oyunlar" },
  { id: "duels", label: "Duels", kind: "socket-namespace", target: "duels", group: "Oyunlar" },
  { id: "battles", label: "Battles", kind: "socket-namespace", target: "battles", group: "Oyunlar" },
  { id: "unbox", label: "Unbox", kind: "socket-namespace", target: "unbox", group: "Oyunlar" },
  { id: "upgrader", label: "Upgrader", kind: "socket-namespace", target: "upgrader", group: "Oyunlar" },
  { id: "wingo", label: "Wingo", kind: "socket-event", target: "general", event: "wingo:public", group: "Oyunlar" },
  { id: "turbo", label: "Turbo", kind: "socket-event", target: "general", event: "turbo:public", group: "Oyunlar" },
  { id: "trade", label: "Trade (Futures)", kind: "socket-event", target: "general", event: "futures:public", group: "Oyunlar" },

  // ---- Sosyal — general namespace altındaki alt modüller ----
  { id: "chat", label: "Chat", kind: "socket-event", target: "general", event: "chat:message", group: "Sosyal (Rain / Vault / Chat)" },
  { id: "rain", label: "Rain", kind: "socket-event", target: "general", event: "rain:update", group: "Sosyal (Rain / Vault / Chat)" },
  { id: "vault", label: "Vault", kind: "socket-event", target: "general", event: "vault:update", group: "Sosyal (Rain / Vault / Chat)" },
  { id: "leaderboard", label: "Leaderboard", kind: "socket-event", target: "general", event: "leaderboard:update", group: "Sosyal (Rain / Vault / Chat)" },
  { id: "rakeback", label: "Rakeback", kind: "socket-event", target: "general", event: "rakeback:update", group: "Sosyal (Rain / Vault / Chat)" },
  { id: "online-counter", label: "Online sayacı", kind: "socket-event", target: "general", event: "init", group: "Sosyal (Rain / Vault / Chat)" },

  // ---- Kasiyer ----
  { id: "cashier-crypto", label: "Kripto yatırma/çekim", kind: "socket-namespace", target: "cashier", group: "Kasiyer" },
  { id: "wallet-convert", label: "Cüzdan / fiat çevrimi", kind: "rest", target: "/wallet/convert-to-fiat", method: "POST", group: "Kasiyer", authRequired: true },
  { id: "exchange-rates", label: "Kur oranları (fiat değiştir)", kind: "rest", target: "/exchange/switch-fiat-currency", method: "POST", group: "Kasiyer", authRequired: true },

  // ---- Ödeme sağlayıcıları (REST) ----
  { id: "forcelab-finance", label: "Forcelab Finance", kind: "rest", target: "/payment/forcelab-finance/methods", group: "Ödeme sağlayıcıları" },
  { id: "meeldev", label: "MeelDev", kind: "rest", target: "/payment/meeldev/methods", group: "Ödeme sağlayıcıları" },
  { id: "galaxypay", label: "GalaxyPay", kind: "rest", target: "/payment/galaxypay/deposit", method: "POST", group: "Ödeme sağlayıcıları", authRequired: true },
  { id: "fluxkripto", label: "FluxKripto", kind: "rest", target: "/payment/fluxkripto/methods", group: "Ödeme sağlayıcıları" },
  { id: "xpayments", label: "XPayments", kind: "rest", target: "/payment/xpayments/methods", group: "Ödeme sağlayıcıları" },

  // ---- Program & Sadakat ----
  { id: "vip", label: "VIP programı", kind: "rest", target: "/vip/levels", group: "Program & Sadakat" },
  { id: "battlepass", label: "Battlepass", kind: "rest", target: "/battlepass/status", group: "Program & Sadakat", authRequired: true },
  { id: "shop", label: "Mağaza", kind: "rest", target: "/shop/purchases", group: "Program & Sadakat", authRequired: true },
  { id: "promo-codes", label: "Promosyon kodları", kind: "rest", target: "/promo-codes/claim", method: "POST", group: "Program & Sadakat", authRequired: true },
  { id: "affiliate", label: "Affiliate", kind: "rest", target: "/affiliate/login", method: "POST", group: "Program & Sadakat", notFoundIsLive: true },
  { id: "race", label: "Race (turnuva)", kind: "rest", target: "/api/race/000000000000000000000000/leaderboard", group: "Program & Sadakat", authRequired: true },
  { id: "sports-tournaments", label: "Spor turnuvaları", kind: "rest", target: "/api/sports-tournaments", group: "Program & Sadakat", authRequired: true },

  // ---- İçerik & Sistem ----
  { id: "site-settings", label: "Site ayarları", kind: "rest", target: "/site-settings", group: "İçerik & Sistem" },
  { id: "banner", label: "Banner", kind: "rest", target: "/banner", group: "İçerik & Sistem" },
  { id: "notices", label: "Bildirimler", kind: "rest", target: "/api/notices", group: "İçerik & Sistem", authRequired: true },
  { id: "gamehistory", label: "Oyun geçmişi", kind: "rest", target: "/gamehistory/recent-big-wins", group: "İçerik & Sistem" },
  { id: "gold-api", label: "Gold API", kind: "rest", target: "/gold_api", method: "POST", group: "İçerik & Sistem" },
  { id: "poker-api", label: "Poker API", kind: "rest", target: "/poker_api", method: "POST", group: "İçerik & Sistem" },
]

export interface CheckResult {
  id: string
  ok: boolean
  status?: number
  detail: string
  latencyMs: number
}

/**
 * REST özellikleri için hafif erişilebilirlik testi. 200 ve 401/403 (auth
 * korumalı ama route canlı) "ok" sayılır; 404/500/timeout "ok" değildir.
 */
export async function checkRestFeature(spec: FeatureSpec): Promise<CheckResult> {
  const start = performance.now()
  const method = spec.method ?? "GET"
  try {
    const res = await fetch(backendUrl(spec.target), {
      method,
      credentials: "include",
      cache: "no-store",
      headers: method === "POST" ? { "Content-Type": "application/json" } : undefined,
      body: method === "POST" ? "{}" : undefined,
    })
    const latencyMs = Math.round(performance.now() - start)

    if (res.status === 404) {
      if (spec.notFoundIsLive) {
        return { id: spec.id, ok: true, status: 404, detail: "canlı (kaynak bulunamadı)", latencyMs }
      }
      return { id: spec.id, ok: false, status: 404, detail: "route bulunamadı", latencyMs }
    }
    if (res.status === 503) {
      // Backend bazı özellikleri kasıtlı olarak "henüz yapılandırılmadı" diye
      // 503 ile kapatıyor (feature-flag benzeri) — bu bir çökme değil, route
      // canlı ve doğru şekilde yanıt veriyor demektir.
      let message = ""
      try {
        const body = await res.clone().json()
        message = typeof body?.message === "string" ? body.message : ""
      } catch {
        // JSON değilse görmezden gel, aşağıdaki genel 503 dalına düşer.
      }
      if (/henüz yapılandırılmadı/i.test(message)) {
        return { id: spec.id, ok: true, status: 503, detail: "yapılandırılmadı (beklenen)", latencyMs }
      }
      return { id: spec.id, ok: false, status: 503, detail: "sunucu hatası", latencyMs }
    }
    if (res.status >= 500) {
      return { id: spec.id, ok: false, status: res.status, detail: "sunucu hatası", latencyMs }
    }
    if (res.status === 401 || res.status === 403) {
      return {
        id: spec.id,
        ok: true,
        status: res.status,
        detail: spec.authRequired ? "korumalı (beklenen)" : "yetkisiz",
        latencyMs,
      }
    }
    // 400 gibi client hataları da route'un canlı olduğunu gösterir (örn.
    // eksik body / geçersiz id) — bu bir "yok" durumu değil.
    if (res.status >= 400 && res.status < 500) {
      return { id: spec.id, ok: true, status: res.status, detail: "canlı (istek hatası)", latencyMs }
    }
    return { id: spec.id, ok: true, status: res.status, detail: "yanıt verdi", latencyMs }
  } catch (err) {
    const latencyMs = Math.round(performance.now() - start)
    return {
      id: spec.id,
      ok: false,
      detail: err instanceof Error ? err.message : "bilinmeyen hata",
      latencyMs,
    }
  }
}
