"use client"

import { useCallback, useState } from "react"
import { apiFetch, ApiError } from "@/lib/api"
import type { CasinoGame } from "@/lib/casino"
import { useAuth } from "@/providers/auth-provider"

interface LaunchResponse {
  status: number
  msg?: string
  launch_url?: string
  details?: string
}

type LaunchState =
  | { phase: "idle" }
  | { phase: "loading" }
  | { phase: "ready"; url: string }
  | { phase: "error"; message: string }

/**
 * Gerçek sağlayıcıdan oyun başlatma URL'i ister (backend: /betinovi_api,
 * method "GetGameUrl"). vendorCode/gameCode Game modelindeki provider_code
 * ve game_code alanlarına karşılık gelir.
 */
export function useGameLaunch() {
  const { user } = useAuth()
  const [state, setState] = useState<LaunchState>({ phase: "idle" })

  const launch = useCallback(
    async (game: CasinoGame) => {
      if (!user) {
        setState({ phase: "error", message: "Oyunu başlatmak için giriş yapmalısın." })
        return
      }
      if (!game.provider_code) {
        setState({
          phase: "error",
          message: "Bu oyun için sağlayıcı bilgisi eksik, şu an başlatılamıyor.",
        })
        return
      }

      setState({ phase: "loading" })
      try {
        const res = await apiFetch<LaunchResponse>("/betinovi_api", {
          method: "POST",
          body: {
            method: "GetGameUrl",
            user_id: user._id,
            vendorCode: game.provider_code,
            gameCode: game.game_code,
            language: "tr",
            channel: "desktop",
          },
        })

        if (res.status === 1 && res.launch_url) {
          setState({ phase: "ready", url: res.launch_url })
        } else {
          setState({
            phase: "error",
            message: res.details || res.msg || "Oyun sağlayıcısından yanıt alınamadı.",
          })
        }
      } catch (err) {
        const message =
          err instanceof ApiError
            ? err.message
            : "Oyun sağlayıcısına şu an ulaşılamıyor. Lütfen daha sonra tekrar dene."
        setState({ phase: "error", message })
      }
    },
    [user],
  )

  const reset = useCallback(() => setState({ phase: "idle" }), [])

  return { state, launch, reset }
}
