import { AUTH_STORAGE_KEY, backendUrl } from "./config"

export class ApiError extends Error {
  status: number
  body: unknown

  constructor(status: number, message: string, body?: unknown) {
    super(message)
    this.name = "ApiError"
    this.status = status
    this.body = body
  }
}

/**
 * Backend hata gövdesi iki farklı şekilde gelebilir:
 * - { success: false, message: "..." }
 * - { success: false, error: { type, message: "..." } }  (bazı uçlarda error string de olabilir)
 * Bu yüzden her iki durumu da güvenle string'e indiriyoruz.
 */
function extractErrorMessage(parsed: unknown): string | null {
  if (typeof parsed !== "object" || parsed === null) return null
  const body = parsed as Record<string, unknown>
  if (typeof body.message === "string" && body.message) return body.message
  if (typeof body.error === "string" && body.error) return body.error
  if (typeof body.error === "object" && body.error !== null) {
    const nested = (body.error as Record<string, unknown>).message
    if (typeof nested === "string" && nested) return nested
  }
  return null
}

function readToken(): string | null {
  if (typeof window === "undefined") return null
  try {
    return window.localStorage.getItem(AUTH_STORAGE_KEY)
  } catch {
    return null
  }
}

export function setToken(token: string | null) {
  if (typeof window === "undefined") return
  try {
    if (token) window.localStorage.setItem(AUTH_STORAGE_KEY, token)
    else window.localStorage.removeItem(AUTH_STORAGE_KEY)
  } catch {
    // private mode
  }
}

export function getToken() {
  return readToken()
}

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown
  /** Token yoksa istek atmadan hata ver. */
  requireAuth?: boolean
}

/**
 * Express backend'e tek giriş noktası. Static frontend, istekleri build
 * sırasında belirlenen public backend adresine doğrudan gönderir.
 */
export async function apiFetch<T>(
  path: string,
  { body, requireAuth, headers, ...init }: RequestOptions = {},
): Promise<T> {
  const token = readToken()

  if (requireAuth && !token) {
    throw new ApiError(401, "unauthenticated")
  }

  const finalHeaders = new Headers(headers)
  if (body !== undefined && !(body instanceof FormData)) {
    finalHeaders.set("Content-Type", "application/json")
  }
  if (token) {
    finalHeaders.set("Authorization", `Bearer ${token}`)
  }

  const res = await fetch(backendUrl(path), {
    ...init,
    headers: finalHeaders,
    credentials: "include",
    body:
      body === undefined
        ? undefined
        : body instanceof FormData
          ? body
          : JSON.stringify(body),
  })

  const raw = await res.text()
  let parsed: unknown = raw
  if (raw) {
    try {
      parsed = JSON.parse(raw)
    } catch {
      // CSS/JS/HTML uçları düz metin döner (/custom.css gibi)
    }
  }

  if (!res.ok) {
    throw new ApiError(res.status, extractErrorMessage(parsed) || res.statusText, parsed)
  }

  return parsed as T
}

/** SWR fetcher. */
export const fetcher = <T>(path: string) => apiFetch<T>(path)

/** Token gerektiren SWR fetcher. */
export const authFetcher = <T>(path: string) =>
  apiFetch<T>(path, { requireAuth: true })
