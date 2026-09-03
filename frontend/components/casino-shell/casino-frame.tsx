"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { AuthDialog } from "@/components/auth/auth-dialog"
import { GameLaunchDialog } from "@/components/casino/game-launch-dialog"
import { PageTransitionPreloader } from "@/components/casino-shell/page-transition-preloader"
import type { CasinoGame } from "@/lib/casino"
import { API_BASE, SOCKET_URL, STORAGE_NAMESPACE, WEBSITE_NAME } from "@/lib/config"

/** Preloader'in en az bu kadar goruntulenmesi saglanir, aksi halde hizli gecislerde goz kirpar gibi durur. */
const MIN_PRELOADER_MS = 450
/** iframe onLoad hic tetiklenmezse (nadir) preloader'i sonsuza kadar takili birakmamak icin guvenlik siniri. */
const PRELOADER_SAFETY_TIMEOUT_MS = 6000

type FrameMessage =
  | { source: "casino-frame"; type: "launch-game"; game: CasinoGame }
  | { source: "casino-frame"; type: "open-auth"; mode: "login" | "register" }
  | { source: "casino-frame"; type: "navigate"; path: string }
  /** iframe icinde sayfa yenilemeden gecis yapildi: sadece adres cubugunu guncelle. */
  | { source: "casino-frame"; type: "replace-path"; path: string }

interface CasinoFrameProps {
  page?: string
  /** Sayfaya özel ek query parametreleri (örn. oyun sayfası için { code }). */
  extraParams?: Record<string, string>
}

export function CasinoFrame({ page = "home", extraParams }: CasinoFrameProps) {
  const router = useRouter()
  const [selectedGame, setSelectedGame] = useState<CasinoGame | null>(null)
  const [authMode, setAuthMode] = useState<"login" | "register">("login")
  const [authOpen, setAuthOpen] = useState(false)
  const frameParams = new URLSearchParams({
    page,
    apiBase: API_BASE,
    socketUrl: SOCKET_URL,
    storageNamespace: STORAGE_NAMESPACE,
    websiteName: WEBSITE_NAME,
    ...extraParams,
  })
  // Oyun kodu değiştiğinde iframe'in baştan kurulması gerekir.
  const frameKey = `${page}:${extraParams?.code ?? ""}`

  // Preloader sadece sayfa GEÇİŞLERİNDE gösterilir, ilk yüklemede gösterilmez.
  const isFirstRender = useRef(true)
  const previousFrameKey = useRef(frameKey)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const transitionStartedAt = useRef(0)
  const safetyTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      previousFrameKey.current = frameKey
      return
    }
    if (previousFrameKey.current === frameKey) return
    previousFrameKey.current = frameKey

    transitionStartedAt.current = Date.now()
    setIsTransitioning(true)

    clearTimeout(safetyTimeoutRef.current)
    safetyTimeoutRef.current = setTimeout(() => setIsTransitioning(false), PRELOADER_SAFETY_TIMEOUT_MS)

    return () => clearTimeout(safetyTimeoutRef.current)
  }, [frameKey])

  function handleFrameLoad() {
    clearTimeout(safetyTimeoutRef.current)
    const elapsed = Date.now() - transitionStartedAt.current
    const remaining = Math.max(0, MIN_PRELOADER_MS - elapsed)
    setTimeout(() => setIsTransitioning(false), remaining)
  }

  useEffect(() => {
    function handleMessage(event: MessageEvent<FrameMessage>) {
      if (event.origin !== window.location.origin || event.data?.source !== "casino-frame") return

      if (event.data.type === "launch-game") setSelectedGame(event.data.game)
      if (event.data.type === "navigate" && event.data.path.startsWith("/")) router.push(event.data.path)
      // router.push iframe'i yeniden yukleyecegi icin burada sadece History API kullaniyoruz.
      if (event.data.type === "replace-path" && event.data.path.startsWith("/")) {
        window.history.replaceState(null, "", event.data.path)
      }
      if (event.data.type === "open-auth") {
        setAuthMode(event.data.mode)
        setAuthOpen(true)
      }
    }

    window.addEventListener("message", handleMessage)
    return () => window.removeEventListener("message", handleMessage)
  }, [router])

  return (
    <main className="relative h-dvh w-full overflow-hidden bg-[#0a131e]">
      <iframe
        key={frameKey}
        src={`/casino-ui/index.html?${frameParams.toString()}`}
        title={`${WEBSITE_NAME} — ${page}`}
        className="h-full w-full border-0"
        onLoad={handleFrameLoad}
      />
      <PageTransitionPreloader visible={isTransitioning} />
      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} initialMode={authMode} />
      <GameLaunchDialog game={selectedGame} onClose={() => setSelectedGame(null)} />
    </main>
  )
}
