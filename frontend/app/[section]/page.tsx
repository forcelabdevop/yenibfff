import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { CasinoFrame } from "@/components/casino-shell/casino-frame"
import { WEBSITE_NAME } from "@/lib/config"

// NOT: "casino" burada YOK — /casino rotasi app/casino/page.tsx tarafindan
// karsilanir. Iki yerde tanimlanmasi trailingSlash ile sonsuz yonlendirme
// dongusune (ERR_TOO_MANY_REDIRECTS) yol aciyordu.
const sections = {
  slots: "Slots",
  originals: `${WEBSITE_NAME} Originals`,
  "live-casino": "Live Casino",
  sports: "Sports Betting",
  bonuses: "Bonuses & Promotions",
  vip: "VIP Club",
  "buy-crypto": "Buy Crypto",
  // Kullanici hesap sayfalari — profil menusunden acilir.
  wallet: "Wallet",
  profile: "My Profile",
  account: "Account",
  transactions: "Transaction History",
  "game-history": "Game History",
  sessions: "Sessions",
  vault: "Vault",
} as const

// Kisisel veri gosteren sayfalar — arama motorlarina kapatiliyor.
const privateSections = new Set<string>([
  "wallet",
  "profile",
  "account",
  "transactions",
  "game-history",
  "sessions",
  "vault",
])

type Section = keyof typeof sections

export function generateStaticParams() {
  return Object.keys(sections).map((section) => ({ section }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ section: string }>
}): Promise<Metadata> {
  const { section } = await params
  const title = sections[section as Section]
  if (!title) return {}

  if (privateSections.has(section)) {
    return {
      title: `${title} | ${WEBSITE_NAME}`,
      description: `Manage your ${title.toLowerCase()} on ${WEBSITE_NAME}.`,
      robots: { index: false, follow: false },
    }
  }

  return { title: `${title} | ${WEBSITE_NAME}`, description: `Explore ${title} on ${WEBSITE_NAME}.` }
}

export default async function SectionPage({
  params,
}: {
  params: Promise<{ section: string }>
}) {
  const { section } = await params
  if (!(section in sections)) notFound()

  return <CasinoFrame page={section} />
}
