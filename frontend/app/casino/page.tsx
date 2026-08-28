import type { Metadata } from "next"
import { CasinoFrame } from "@/components/casino-shell/casino-frame"
import { WEBSITE_NAME } from "@/lib/config"

export const metadata: Metadata = {
  title: `Casino | ${WEBSITE_NAME}`,
  description: `Explore slots, live casino tables and ${WEBSITE_NAME} Originals.`,
}

export default function CasinoPage() {
  return <CasinoFrame page="casino" />
}
