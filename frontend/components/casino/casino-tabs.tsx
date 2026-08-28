"use client"

import { Cherry, Dices, Gamepad2, Radio, Search, Sparkles, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { CASINO_TABS, type CasinoTabId } from "@/lib/casino-page"

const TAB_ICONS = {
  gamepad: Gamepad2,
  sparkles: Sparkles,
  cherry: Cherry,
  radio: Radio,
  dices: Dices,
} as const

/**
 * referans casino arayüzü'daki sekme çubuğu + arama satırı.
 *
 * Referans ölçüleri: pill yüksekliği 46px, köşe yarıçapı 12px, aralarında
 * 8px boşluk; aktif pill mavi (#2283F6) zeminli beyaz metin, pasifler koyu
 * yüzey. Arama kutusu satırın sağ ucunda yer alır ve mobilde alt satıra iner.
 */
export function CasinoTabs({
  active,
  onSelect,
  query,
  onQueryChange,
}: {
  active: CasinoTabId
  onSelect: (id: CasinoTabId) => void
  query: string
  onQueryChange: (value: string) => void
}) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-3">
      <div
        role="tablist"
        aria-label="Casino kategorileri"
        className="scrollbar-hidden -mx-3 flex gap-2 overflow-x-auto px-3 md:mx-0 md:min-w-0 md:flex-1 md:px-0"
      >
        {CASINO_TABS.map((tab) => {
          const Icon = TAB_ICONS[tab.icon as keyof typeof TAB_ICONS]
          const isActive = tab.id === active

          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onSelect(tab.id)}
              className={cn(
                "flex h-[46px] shrink-0 items-center gap-2 rounded-xl px-4 text-sm font-semibold transition-colors",
                isActive
                  ? "bg-accent text-accent-foreground"
                  : "bg-card text-muted-foreground hover:bg-secondary hover:text-foreground",
              )}
            >
              <Icon className={cn("size-5", isActive ? "text-accent-foreground" : "text-primary")} aria-hidden="true" />
              {tab.label}
              {tab.count ? (
                <span
                  className={cn(
                    "tabular rounded-md px-1.5 py-0.5 text-xs font-bold",
                    isActive ? "bg-[rgba(0,0,0,0.22)] text-accent-foreground" : "bg-secondary text-muted-foreground",
                  )}
                >
                  {tab.count}
                </span>
              ) : null}
            </button>
          )
        })}
      </div>

      <div className="relative w-full md:w-[172px] md:shrink-0 lg:w-[220px]">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <input
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Ara"
          aria-label="Oyun ara"
          className="h-[46px] w-full rounded-xl bg-card pl-9 pr-9 text-sm font-medium text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-search-cancel-button]:hidden"
        />
        {query ? (
          <button
            type="button"
            onClick={() => onQueryChange("")}
            aria-label="Aramayı temizle"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        ) : null}
      </div>
    </div>
  )
}
