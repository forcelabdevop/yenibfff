"use client"

import Image from "next/image"
import { RailItem, RailShell } from "@/components/casino/rail-shell"
import { CASINO_WINS } from "@/lib/casino-page"

/**
 * referans casino arayüzü'daki "Recent Top Wins" rafı: her kart oyun görseli,
 * TOP rozeti ve altında kazanç tutarı + kazanan kullanıcı satırı gösterir.
 * Tutarlar gösterim amaçlıdır, gerçek kazanç kaydı değildir.
 */
export function TopWinsRail() {
  return (
    <RailShell title="Son Büyük Kazançlar" icon="trophy">
      {CASINO_WINS.map((win) => (
        <RailItem key={win.id}>
          <div className="overflow-hidden rounded-[14px] bg-card">
            <div className="relative aspect-[174/196]">
              <Image
                src={win.image || "/placeholder.svg"}
                alt={win.game}
                fill
                sizes="(min-width: 1024px) 170px, 33vw"
                className="object-cover"
              />
              <span className="btn-3d-primary absolute left-[7px] top-[7px] rounded-full px-2.5 py-1 text-[11px] font-bold uppercase leading-none tracking-wide text-primary-foreground">
                Top
              </span>
            </div>

            <div className="flex flex-col items-center gap-1 px-2 py-2">
              <span className="tabular text-sm font-bold leading-none text-foreground">{win.amount}</span>
              <span className="flex min-w-0 items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className="size-4 shrink-0 rounded-full bg-[linear-gradient(135deg,#fb1949_0%,#2f7bf5_100%)]"
                />
                <span className="truncate text-xs font-medium text-accent">{win.username}</span>
              </span>
            </div>
          </div>
        </RailItem>
      ))}
    </RailShell>
  )
}
