import { Dice5, Gauge, Radio } from "lucide-react"
import { MOCK_LIVE_BETS } from "@/lib/mock-lobby"
import { formatFiat } from "@/lib/currency"
import { cn } from "@/lib/utils"

/**
 * referans casino arayüzü'in ana sayfadaki canlı bahis tablosunun birebir kopyası: sürekli
 * güncellenen bir görünüm veren, oyun ikonu + kullanıcı avatarı + tutar
 * satırlarından oluşan kompakt bir liste. Veriler sabittir, gerçek bir bahis
 * akışını temsil etmez.
 */
export function LiveBetsTicker() {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Radio className="size-4 text-primary" aria-hidden="true" />
        <h2 className="text-base font-semibold text-foreground">Canlı bahisler</h2>
        <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
          <span className="size-1.5 animate-pulse rounded-full bg-primary" />
          Canlı
        </span>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="grid grid-cols-[1fr_auto] gap-3 border-b border-border px-4 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          <span>Oyun</span>
          <span>Tutar</span>
        </div>

        <ul className="divide-y divide-border">
          {MOCK_LIVE_BETS.map((bet) => (
            <li key={bet.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
              <div className="flex items-center gap-2.5">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  {bet.icon === "dice" ? (
                    <Dice5 className="size-4" aria-hidden="true" />
                  ) : (
                    <Gauge className="size-4" aria-hidden="true" />
                  )}
                </span>
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-foreground">{bet.game}</span>
                  <span className="text-xs text-muted-foreground">User{100000 + bet.avatarSeed * 137}</span>
                </div>
              </div>

              <span
                className={cn(
                  "tabular text-sm font-bold",
                  bet.amount > 0 ? "text-primary" : "text-muted-foreground",
                )}
              >
                {formatFiat(bet.amount, "TRY")}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
