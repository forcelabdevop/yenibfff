import type { Metadata } from "next"
import { Suspense } from "react"
import { GameRouteFrame } from "@/components/casino/game-route-frame"
import { WEBSITE_NAME } from "@/lib/config"

export const metadata: Metadata = {
  title: `Play Casino Games | ${WEBSITE_NAME}`,
  description: `Launch slots, live tables and originals instantly on ${WEBSITE_NAME}. Game details, RTP and top wins in one place.`,
}

export default function GamePage() {
  return (
    <Suspense fallback={<div className="h-dvh w-full bg-[#0a131e]" />}>
      <GameRouteFrame />
    </Suspense>
  )
}
