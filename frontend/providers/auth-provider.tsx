"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"
import useSWR from "swr"
import { apiFetch, authFetcher, getToken, setToken } from "@/lib/api"
import type { User } from "@/lib/types"
import { releaseAllSockets } from "@/lib/socket"
import { USER_ID_STORAGE_KEY } from "@/lib/config"

interface LoginResult {
  /** Backend MFA istiyorsa true döner — OTP ekranına geçilir. */
  mfaRequired: boolean
}

interface AuthContextValue {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (identifier: string, password: string) => Promise<LoginResult>
  register: (payload: Record<string, unknown>) => Promise<void>
  validateOtp: (code: string) => Promise<void>
  logout: () => void
  refresh: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

/** Login/OTP yanıtından token'ı çıkarır — backend alan adı tutarsız. */
function extractToken(res: unknown): string | null {
  if (typeof res !== "object" || res === null) return null
  const obj = res as Record<string, unknown>
  for (const key of ["token", "accessToken", "jwt"]) {
    if (typeof obj[key] === "string") return obj[key] as string
  }
  return null
}

function extractUserId(res: unknown): string | null {
  if (typeof res !== "object" || res === null) return null
  const obj = res as Record<string, unknown>
  if (typeof obj.userId === "string") return obj.userId
  const user = obj.user as Record<string, unknown> | undefined
  if (user && typeof user._id === "string") return user._id
  return null
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null)
  const [bootstrapped, setBootstrapped] = useState(false)

  // Token localStorage'da; JWT payload'ından id okumak yerine login
  // yanıtındaki id'yi saklıyoruz.
  useEffect(() => {
    try {
      const storedId = window.localStorage.getItem(USER_ID_STORAGE_KEY)
      if (storedId && getToken()) setUserId(storedId)
    } catch {
      // private mode
    }
    setBootstrapped(true)
  }, [])

  const persistSession = useCallback((token: string | null, id: string | null) => {
    setToken(token)
    setUserId(id)
    try {
      if (id) window.localStorage.setItem(USER_ID_STORAGE_KEY, id)
      else window.localStorage.removeItem(USER_ID_STORAGE_KEY)
    } catch {
      // private mode
    }
  }, [])

  const {
    data: user,
    isLoading,
    mutate,
  } = useSWR<User>(userId ? `/user/${userId}` : null, authFetcher, {
    revalidateOnFocus: false,
    shouldRetryOnError: false,
  })

  const login = useCallback(
    async (identifier: string, password: string): Promise<LoginResult> => {
      const trimmed = identifier.trim()
      // Backend tek bir "identifier" alanı kabul etmiyor; email/telefon/kullanıcı
      // adına göre doğru alanı seçmemiz gerekiyor.
      const loginField = trimmed.includes("@")
        ? { email: trimmed }
        : /^\+?[0-9]{6,}$/.test(trimmed)
          ? { phone: trimmed }
          : { username: trimmed }

      const res = await apiFetch<unknown>("/auth/credentials", {
        method: "POST",
        body: { ...loginField, password },
      })

      const token = extractToken(res)
      const id = extractUserId(res)

      // Token yoksa MFA adımı bekleniyor — id'yi tutup OTP ekranına geçiyoruz.
      if (!token) {
        if (id) setUserId(id)
        return { mfaRequired: true }
      }

      persistSession(token, id)
      return { mfaRequired: false }
    },
    [persistSession],
  )

  const register = useCallback(async (payload: Record<string, unknown>) => {
    const res = await apiFetch<unknown>("/auth/credentials/register", {
      method: "POST",
      body: payload,
    })
    const token = extractToken(res)
    if (token) persistSession(token, extractUserId(res))
  }, [persistSession])

  const validateOtp = useCallback(
    async (code: string) => {
      const res = await apiFetch<unknown>(
        "/auth/credentials/mfa/validate-otp",
        { method: "POST", body: { userId, code, otp: code } },
      )
      const token = extractToken(res)
      if (!token) throw new Error("otp_failed")
      persistSession(token, extractUserId(res) ?? userId)
    },
    [userId, persistSession],
  )

  const logout = useCallback(() => {
    persistSession(null, null)
    releaseAllSockets()
    mutate(undefined, { revalidate: false })
  }, [persistSession, mutate])

  const value = useMemo<AuthContextValue>(
    () => ({
      user: user ?? null,
      isLoading: !bootstrapped || (!!userId && isLoading),
      isAuthenticated: !!user,
      login,
      register,
      validateOtp,
      logout,
      refresh: () => void mutate(),
    }),
    [
      user,
      bootstrapped,
      userId,
      isLoading,
      login,
      register,
      validateOtp,
      logout,
      mutate,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider")
  return ctx
}
