import Image from "next/image"
import Link from "next/link"
import { ChevronRight, Flame } from "lucide-react"
import { GAME_PICKS } from "@/lib/mock-lobby"

export function GamePickerRow() {
  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <Flame className="size-4 text-primary" aria-hidden="true" />
          Hot Picks
        </h2>
        <Link href="/casino" className="flex items-center gap-1 text-[11px] font-semibold text-accent">
          Tümünü gör <ChevronRight className="size-3" aria-hidden="true" />
        </Link>
      </div>
      <div className="scrollbar-hidden -mx-3 flex gap-2 overflow-x-auto px-3 pb-1 md:-mx-5 md:px-5">
        {GAME_PICKS.map((pick) => (
          <Link key={pick.id} href="/#originals" className="group flex w-28 shrink-0 flex-col gap-1.5 sm:w-32">
            <span className="relative aspect-[4/5] overflow-hidden rounded-md bg-card ring-1 ring-border transition group-hover:ring-primary/60">
              <Image src={pick.image || "/placeholder.svg"} alt={pick.name} fill sizes="128px" className="object-cover transition-transform duration-300 group-hover:scale-105" />
              {pick.top && <span className="btn-3d-primary absolute bottom-1.5 left-1.5 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase text-primary-foreground">Top</span>}
            </span>
            <span className="truncate text-xs font-semibold text-foreground">{pick.name}</span>
          </Link>
        ))}
      </div>
    </section>
  )
}
