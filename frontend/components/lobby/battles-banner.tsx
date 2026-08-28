import Image from "next/image"
import Link from "next/link"
import { Clock, Swords } from "lucide-react"
import { cn } from "@/lib/utils"
import { BATTLE_BANNERS } from "@/lib/mock-lobby"

/**
 * referans casino arayüzü'in "Battles & Tournaments" bölümünün birebir kopyası: yan yana
 * kaydırılan iki büyük banner, geri sayım rozeti ve CTA metniyle.
 */
export function BattlesBanner() {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Swords className="size-4 text-primary" aria-hidden="true" />
        <h2 className="text-base font-semibold text-foreground">Turnuvalar &amp; Battles</h2>
      </div>

      <div className="scrollbar-hidden -mx-4 flex gap-3 overflow-x-auto px-4 pb-1 md:-mx-6 md:px-6">
        {BATTLE_BANNERS.map((banner) => (
          <Link
            key={banner.id}
            href="/casino"
            className="group relative flex h-48 w-72 shrink-0 flex-col justify-between overflow-hidden rounded-md border border-border p-3"
          >
            <Image
              src={banner.image || "/placeholder.svg"}
              alt=""
              fill
              sizes="280px"
              className="object-cover transition-transform duration-300 group-hover:scale-105"
            />
            <div
              className={cn(
                "absolute inset-0 bg-gradient-to-t via-transparent",
                banner.accent === "red" ? "from-destructive/80" : "from-primary/80",
              )}
            />

            <span className="relative z-10 inline-flex w-fit items-center gap-1 rounded-full bg-background/70 px-2 py-1 text-[11px] font-semibold text-foreground backdrop-blur-sm">
              <Clock className="size-3" aria-hidden="true" />
              {banner.timeLabel}
            </span>

            <div className="relative z-10 flex flex-col gap-0.5">
              <span className="text-base font-bold text-foreground text-balance">{banner.title}</span>
              <span className="line-clamp-2 text-xs text-foreground/80">{banner.description}</span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}
