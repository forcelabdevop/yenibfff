"use client"

import { useSearchParams } from "next/navigation"
import { CasinoFrame } from "@/components/casino-shell/casino-frame"

/**
 * Statik export uyumlu oyun rotası.
 * Oyun kodu URL'den (?code=...) okunur ve casino-ui kabuğuna "game" sayfası
 * olarak devredilir; böylece sidebar/header/chat korunur.
 */
export function GameRouteFrame() {
  const searchParams = useSearchParams()
  const code = searchParams.get("code")?.trim() ?? ""

  return <CasinoFrame page="game" extraParams={code ? { code } : undefined} />
}
