"use client"

import { useRef } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { GameCard } from "@/components/casino/game-card"
import type { CategoryWithGames, CasinoGame } from "@/lib/casino"

export function CategoryRail({
  category,
  onPlay,
  onSeeAll,
}: {
  category: CategoryWithGames
  onPlay: (game: CasinoGame) => void
  onSeeAll: (slug: string) => void
}) {
  const scrollerRef = useRef<HTMLDivElement>(null)

  if (category.games.length === 0) return null

  function scrollBy(direction: -1 | 1) {
    const el = scrollerRef.current
    if (!el) return
    el.scrollBy({ left: direction * el.clientWidth * 0.8, behavior: "smooth" })
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-foreground">{category.name}</h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onSeeAll(category.slug)}
            className="flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-primary"
          >
            Tümünü gör ({category.total_games})
          </button>
          <div className="hidden items-center gap-1.5 sm:flex">
            <button
              type="button"
              onClick={() => scrollBy(-1)}
              aria-label={`${category.name} rafını sola kaydır`}
              className="inline-flex size-7 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
            >
              <ChevronLeft className="size-3.5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => scrollBy(1)}
              aria-label={`${category.name} rafını sağa kaydır`}
              className="inline-flex size-7 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
            >
              <ChevronRight className="size-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      <div
        ref={scrollerRef}
        className="scrollbar-hidden -mx-4 flex gap-3 overflow-x-auto px-4 pb-1 md:-mx-6 md:px-6"
      >
        {category.games.map((game) => (
          <GameCard
            key={game._id}
            game={game}
            onPlay={onPlay}
            className="w-28 shrink-0 sm:w-32 md:w-36"
          />
        ))}
      </div>
    </section>
  )
}
