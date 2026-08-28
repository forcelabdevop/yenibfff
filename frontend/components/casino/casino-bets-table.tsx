"use client"

import { useState } from "react"
import { Coins, Sparkles, TrendingUp } from "lucide-react"
import { cn } from "@/lib/utils"
import { BET_TABS, CASINO_BETS, type BetTabId } from "@/lib/casino-page"

const BET_TAB_ICONS = {
  coins: Coins,
  trending: TrendingUp,
  sparkles: Sparkles,
} as const

/**
 * referans casino arayüzü'nun alt kısmındaki canlı bahis tablosu.
 *
 * Üstte üç sekme (Tüm Bahisler / Yüksek Oyuncular / Nadir Kazançlar) ve satır
 * sayısı seçici, altında OYUN, ZAMAN, KULLANICI, BAHİS, ÇARPAN, ÖDEME
 * sütunlu tablo yer alır. Satırlar gösterim amaçlıdır, gerçek bahis değildir.
 */
export function CasinoBetsTable() {
  const [tab, setTab] = useState<BetTabId>("all")
  const [rowCount, setRowCount] = useState(10)

  const rows = CASINO_BETS[tab].slice(0, rowCount)

  return (
    <section aria-label="Son bahisler" className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div
          role="tablist"
          aria-label="Bahis listesi filtreleri"
          className="scrollbar-hidden flex gap-1 overflow-x-auto rounded-xl bg-card p-1"
        >
          {BET_TABS.map((item) => {
            const Icon = BET_TAB_ICONS[item.icon as keyof typeof BET_TAB_ICONS]
            const isActive = item.id === tab

            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setTab(item.id)}
                className={cn(
                  "flex h-10 shrink-0 items-center gap-2 rounded-lg px-4 text-sm font-semibold transition-colors",
                  isActive
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className={cn("size-4", isActive ? "text-accent-foreground" : "text-primary")} aria-hidden="true" />
                {item.label}
              </button>
            )
          })}
        </div>

        <label className="flex items-center gap-2 self-end text-sm text-muted-foreground">
          <span className="sr-only">Gösterilecek satır sayısı</span>
          <select
            value={rowCount}
            onChange={(event) => setRowCount(Number(event.target.value))}
            className="h-10 rounded-xl bg-card px-3 text-sm font-semibold text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {[5, 10].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="scrollbar-hidden overflow-x-auto">
        <table className="w-full min-w-[720px] border-separate border-spacing-y-1 text-sm">
          <thead>
            <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <th scope="col" className="px-4 pb-1 font-semibold">Oyun</th>
              <th scope="col" className="px-4 pb-1 font-semibold">Zaman</th>
              <th scope="col" className="px-4 pb-1 font-semibold">Kullanıcı</th>
              <th scope="col" className="px-4 pb-1 font-semibold">Bahis</th>
              <th scope="col" className="px-4 pb-1 font-semibold">Çarpan</th>
              <th scope="col" className="px-4 pb-1 font-semibold">Ödeme</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.id} className={index % 2 === 0 ? "bg-card" : "bg-transparent"}>
                <td className="rounded-l-lg px-4 py-3">
                  <span className="flex items-center gap-2">
                    <span
                      aria-hidden="true"
                      className="size-5 shrink-0 rounded-md bg-[linear-gradient(135deg,#2f7bf5_0%,#7b3ff5_100%)]"
                    />
                    <span className="font-medium text-foreground">{row.game}</span>
                  </span>
                </td>
                <td className="tabular px-4 py-3 font-medium text-foreground">{row.time}</td>
                <td className="px-4 py-3">
                  <span className="flex items-center gap-2">
                    <span className="relative shrink-0">
                      <span
                        aria-hidden="true"
                        className="block size-6 rounded-full bg-[linear-gradient(135deg,#fb1949_0%,#2f7bf5_100%)]"
                      />
                      <span className="tabular absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-sm bg-secondary px-1 text-[9px] font-bold leading-tight text-foreground">
                        {row.level}
                      </span>
                    </span>
                    <span className="font-medium text-foreground">{row.user}</span>
                  </span>
                </td>
                <td className="tabular px-4 py-3 font-semibold text-foreground">{row.bet}</td>
                <td className="px-4 py-3">
                  <span className="tabular rounded-md bg-secondary px-2 py-1 text-xs font-bold text-muted-foreground">
                    {row.multiplier}
                  </span>
                </td>
                <td
                  className={cn(
                    "tabular rounded-r-lg px-4 py-3 font-semibold",
                    row.won ? "text-[#31c48d]" : "text-muted-foreground",
                  )}
                >
                  {row.payout}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
