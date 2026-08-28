/**
 * Tek kaynak: backend adresleri ve pazar varsayılanları.
 * Kontrat için bkz. docs/API-CONTRACT.md
 */

const normalizeOrigin = (value: string) => value.replace(/\/+$/, "")

export const WEBSITE_NAME =
  process.env.NEXT_PUBLIC_WEBSITE_NAME?.trim() || "Forcelab"

export const PROJECT_ID =
  process.env.NEXT_PUBLIC_PROJECT_ID?.trim() || "local"

// Static export'ta Next.js sunucusu/proxy'si yoktur. Bu adres build sırasında
// tarayıcı bundle'ına yazılır ve REST istekleri doğrudan Express'e gider.
export const API_BASE = normalizeOrigin(
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000",
)

// Ayrı bir socket adresi verilmezse REST backend adresi kullanılır.
export const SOCKET_URL = normalizeOrigin(
  process.env.NEXT_PUBLIC_SOCKET_URL || API_BASE,
)

export function backendUrl(path: string): string {
  if (/^(?:https?:|data:|blob:)/i.test(path)) return path
  return `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`
}

/** EU pazarı varsayılanları. TR kurulumunda bunlar TRY/tr idi. */
export const DEFAULT_FIAT = "EUR"
export const DEFAULT_LOCALE = "en"

export const STORAGE_NAMESPACE =
  WEBSITE_NAME.toLowerCase().replace(/[^a-z0-9.-]+/g, "-").replace(/^-|-$/g, "") || "website"

export const AUTH_STORAGE_KEY = `${STORAGE_NAMESPACE}.token`
export const USER_ID_STORAGE_KEY = `${STORAGE_NAMESPACE}.userId`
export const LOCALE_STORAGE_KEY = `${STORAGE_NAMESPACE}.locale`
export const FIAT_STORAGE_KEY = `${STORAGE_NAMESPACE}.fiat`
export const WALLET_STORAGE_KEY = `${STORAGE_NAMESPACE}.wallet`
