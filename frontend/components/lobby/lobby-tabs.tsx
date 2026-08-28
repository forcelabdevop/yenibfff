"use client"

import Link from "next/link"
import { Search } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * referans casino arayüzü'in lobi sekmeleri barının birebir kopyası: sol tarafta arama
 * ikonu, sağ tarafta yatay kaydırılan "Lobi / Originals / Slotlar / ..."
 * çipleri. Sekmeler görsel gezinme amaçlıdır, tümü casino kataloğuna gider.
 */
const TABS: { label: string; count?: string; href: string }[] = [
  { label: "Lobi", href: "/casino" },
  { label: "Originals", count: "24", href: "/#originals" },
  { label: "Slotlar", count: "10.7k", href: "/casino" },
  { label: "Canlı Casino", count: "1.2k", href: "/casino" },
  { label: "Rulet", count: "254", href: "/casino" },
  { label: "Blackjack", count: "777", href: "/casino" },
  { label: "Oyun Şovları", count: "36", href: "/casino" },
]

export function LobbyTabs() {
  return (
    <div className="flex items-center gap-4">
      <div className="scrollbar-hidden flex flex-1 gap-2 overflow-x-auto pb-1">
        {TABS.slice(0, 5).map((tab, i) => (
          <Link
            key={tab.label}
            href={tab.href}
            className={cn(
              "flex h-12 shrink-0 items-center gap-2 rounded-xl px-4 text-sm font-semibold transition-colors",
              i === 0
                ? "bg-accent text-accent-foreground shadow-lg shadow-accent/15"
                : "bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
            {tab.count && <span className="text-xs font-bold opacity-80">{tab.count}</span>}
          </Link>
        ))}
      </div>

      <Link
        href="/casino"
        aria-label="Oyun ara"
        className="hidden h-12 w-44 shrink-0 items-center gap-3 rounded-xl bg-card px-4 text-sm text-muted-foreground transition-colors hover:text-foreground md:flex"
      >
        <Search className="size-5" aria-hidden="true" />
        Oyun ara
      </Link>
    </div>
  )
}
