"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { AuthDialog } from "@/components/auth/auth-dialog"
import { GameLaunchDialog } from "@/components/casino/game-launch-dialog"
import type { CasinoGame } from "@/lib/casino"
import { API_BASE, SOCKET_URL, STORAGE_NAMESPACE, WEBSITE_NAME } from "@/lib/config"

type FrameMessage =
  | { source: "casino-frame"; type: "launch-game"; game: CasinoGame }
  | { source: "casino-frame"; type: "open-auth"; mode: "login" | "register" }
  | { source: "casino-frame"; type: "navigate"; path: string }

interface CasinoFrameProps {
  page?: string
}

export function CasinoFrame({ page = "home" }: CasinoFrameProps) {
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
  })

  useEffect(() => {
    function handleMessage(event: MessageEvent<FrameMessage>) {
      if (event.origin !== window.location.origin || event.data?.source !== "casino-frame") return

      if (event.data.type === "launch-game") setSelectedGame(event.data.game)
      if (event.data.type === "navigate" && event.data.path.startsWith("/")) router.push(event.data.path)
      if (event.data.type === "open-auth") {
        setAuthMode(event.data.mode)
        setAuthOpen(true)
      }
    }

    window.addEventListener("message", handleMessage)
    return () => window.removeEventListener("message", handleMessage)
  }, [router])

  return (
    <main className="h-dvh w-full overflow-hidden bg-[#0a131e]">
      <iframe
        key={page}
        src={`/casino-ui/index.html?${frameParams.toString()}`}
        title={`${WEBSITE_NAME} — ${page}`}
        className="h-full w-full border-0"
      />
      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} initialMode={authMode} />
      <GameLaunchDialog game={selectedGame} onClose={() => setSelectedGame(null)} />
    </main>
  )
}
