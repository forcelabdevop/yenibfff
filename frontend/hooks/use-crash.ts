"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { getSocket, releaseSocket, NAMESPACES } from "@/lib/socket"
import { useAuth } from "@/providers/auth-provider"
import type { CrashGame, CrashBet, CrashInitPayload } from "@/lib/types"

/**
 * Backend'de çarpan formülü (utils/crash.js → crashGetGameMultiplier):
 *   multiplier = floor(100 * e^(0.00006 * elapsedMs))
 * Sunucu "tick" event'ini ~150ms'de bir gönderir; biz ekranda akıcı görünmesi
 * için aynı formülü client'ta requestAnimationFrame ile interpole ediyoruz,
 * sunucudan gelen "tick" ise düzeltici referans olarak kullanılıyor.
 */
function computeMultiplier(elapsedMs: number) {
  return Math.floor(100 * Math.exp(0.00006 * elapsedMs))
}

interface SendBetResponse {
  success: boolean
  user?: unknown
  error?: { type: string; message: string }
}

export function useCrash() {
  const { user, isAuthenticated, refresh } = useAuth()
  const [game, setGame] = useState<CrashGame | null>(null)
  const [bets, setBets] = useState<CrashBet[]>([])
  const [history, setHistory] = useState<CrashGame[]>([])
  const [liveMultiplier, setLiveMultiplier] = useState(100)
  const [connected, setConnected] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const gameRef = useRef<CrashGame | null>(null)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    gameRef.current = game
  }, [game])

  useEffect(() => {
    const socket = getSocket(NAMESPACES.crash, user?._id)
    setConnected(socket.connected)

    const onConnect = () => setConnected(true)
    const onDisconnect = () => setConnected(false)

    const onInit = (payload: CrashInitPayload) => {
      setGame(payload.game)
      setBets(payload.bets ?? [])
      setHistory(payload.history ?? [])
    }

    const onGame = ({ game: nextGame }: { game: CrashGame }) => {
      setGame(nextGame)
      if (nextGame.state === "created") {
        setBets([])
        setLiveMultiplier(100)
      }
      if (nextGame.state === "completed") {
        setHistory((prev) => [nextGame, ...prev].slice(0, 25))
      }
    }

    const onBet = ({ bet }: { bet: CrashBet }) => {
      setBets((prev) => {
        const idx = prev.findIndex((b) => b._id === bet._id)
        if (idx === -1) return [...prev, bet]
        const next = [...prev]
        next[idx] = bet
        return next
      })
      // Kullanıcının kendi bahsi cashout edildiyse bakiyesi /general üzerinden
      // "user" event'i ile güncellenir; auth-provider zaten onu dinliyor.
    }

    const onTick = ({ multiplier }: { multiplier: number }) => {
      setLiveMultiplier(multiplier)
    }

    socket.on("connect", onConnect)
    socket.on("disconnect", onDisconnect)
    socket.on("init", onInit)
    socket.on("game", onGame)
    socket.on("bet", onBet)
    socket.on("tick", onTick)

    return () => {
      socket.off("connect", onConnect)
      socket.off("disconnect", onDisconnect)
      socket.off("init", onInit)
      socket.off("game", onGame)
      socket.off("bet", onBet)
      socket.off("tick", onTick)
      releaseSocket(NAMESPACES.crash, user?._id)
    }
    // user?._id değişince (login/logout) yeniden bağlan — auth token değişti.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?._id])

  // Client-taraflı akıcı çarpan animasyonu (state === "rolling" iken).
  useEffect(() => {
    if (game?.state !== "rolling") {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      return
    }

    const startedAt = game.updatedAt
    const tick = () => {
      const elapsed = Date.now() - startedAt
      setLiveMultiplier(computeMultiplier(elapsed))
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [game?.state, game?.updatedAt])

  const myBet = user ? bets.find((b) => b.user._id === user._id) ?? null : null

  const placeBet = useCallback(
    (amount: number, autoCashout: number) => {
      return new Promise<SendBetResponse>((resolve) => {
        setActionError(null)
        if (!isAuthenticated) {
          const res = { success: false, error: { type: "error", message: "Bahis yapmak için giriş yapmalısın." } }
          setActionError(res.error.message)
          resolve(res)
          return
        }
        const socket = getSocket(NAMESPACES.crash, user?._id)
        socket.emit(
          "sendBet",
          // Backend x100 ölçek bekliyor (100 = 1.00x); 0 = auto cashout yok.
          { amount, autoCashout: autoCashout > 0 ? Math.floor(autoCashout * 100) : 0 },
          (res: SendBetResponse) => {
            if (!res.success) setActionError(res.error?.message ?? "Bahis başarısız.")
            else refresh()
            resolve(res)
          },
        )
      })
    },
    [isAuthenticated, user?._id, refresh],
  )

  const cashout = useCallback(() => {
    return new Promise<SendBetResponse>((resolve) => {
      setActionError(null)
      const socket = getSocket(NAMESPACES.crash, user?._id)
      socket.emit("sendCashout", {}, (res: SendBetResponse) => {
        if (!res.success) setActionError(res.error?.message ?? "Cashout başarısız.")
        else refresh()
        resolve(res)
      })
    })
  }, [user?._id, refresh])

  return {
    game,
    bets,
    history,
    liveMultiplier,
    connected,
    myBet,
    placeBet,
    cashout,
    actionError,
  }
}
