import Image from "next/image"
import { Trophy } from "lucide-react"
import { MOCK_TOP_WINS } from "@/lib/mock-lobby"
import { formatFiat } from "@/lib/currency"

/**
 * referans casino arayüzü'in "Recent Top Wins" yatay rafının birebir kopyası: her kart
 * oyun görseli + TOP rozeti + kazanç tutarı + kullanıcı adı gösterir.
 */
export function RecentTopWins() {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Trophy className="size-4 text-primary" aria-hidden="true" />
        <h2 className="text-base font-semibold text-foreground">Son büyük kazançlar</h2>
      </div>

      <div className="scrollbar-hidden -mx-4 flex gap-3 overflow-x-auto px-4 pb-1 md:-mx-6 md:px-6">
        {MOCK_TOP_WINS.map((win) => (
          <div
            key={win.id}
            className="flex w-36 shrink-0 flex-col overflow-hidden rounded-md border border-border bg-card"
          >
            <div className="relative aspect-square">
              <Image src={win.image || "/placeholder.svg"} alt={win.game} fill sizes="160px" className="object-cover" />
              <span className="btn-3d-primary absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary-foreground">
                Top
              </span>
            </div>
            <div className="flex flex-col gap-0.5 p-2.5">
              <span className="tabular text-sm font-bold text-primary">{formatFiat(win.amount, "TRY")}</span>
              <span className="line-clamp-1 text-xs text-muted-foreground">{win.username}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
