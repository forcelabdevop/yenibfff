"use client"

import { useRef } from "react"
import Link from "next/link"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { GameCardShell } from "@/components/casino/game-card-shell"
import type { MockRail } from "@/lib/mock-lobby"

/**
 * referans casino arayüzü'in Rulet / Blackjack / Canlı Casino / Highroller Hall / Oyun
 * Şovları gibi backend'de karşılığı olmayan raflarının görsel klonu.
 * `CategoryRail` ile aynı tasarım dilini kullanır ama gerçek oyun API'sine
 * bağlanmaz — tıklama, giriş/kayıt akışına yönlendirir.
 */
/**
 * Karta yazılacak gösterim amaçlı RTP değeri. Bu raflar backend'e bağlı
 * olmadığı için gerçek bir RTP yoktur; değer, sunucu ve istemcide aynı sonucu
 * vermesi (hydration uyuşmazlığı olmaması) için oyun id'sinden türetilir.
 */
function mockRtp(id: string) {
  let hash = 0
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) % 400
  return 94 + hash / 100
}

export function MockGameRail({ rail, onSelect }: { rail: MockRail; onSelect: () => void }) {
  const scrollerRef = useRef<HTMLDivElement>(null)

  function scrollBy(direction: -1 | 1) {
    const el = scrollerRef.current
    if (!el) return
    el.scrollBy({ left: direction * el.clientWidth * 0.8, behavior: "smooth" })
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-foreground">{rail.name}</h2>
        <div className="flex items-center gap-2">
          <Link
            href="/casino"
            className="flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-primary"
          >
            Tümünü gör ({rail.total})
          </Link>
          <div className="hidden items-center gap-1.5 sm:flex">
            <button
              type="button"
              onClick={() => scrollBy(-1)}
              aria-label={`${rail.name} rafını sola kaydır`}
              className="inline-flex size-7 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
            >
              <ChevronLeft className="size-3.5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => scrollBy(1)}
              aria-label={`${rail.name} rafını sağa kaydır`}
              className="inline-flex size-7 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
            >
              <ChevronRight className="size-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      <div
        ref={scrollerRef}
        className="scrollbar-hidden -mx-4 flex gap-4 overflow-x-auto px-4 py-2 md:-mx-6 md:px-6"
      >
        {rail.games.map((game) => (
          <GameCardShell
            key={game.id}
            image={game.image}
            name={game.name}
            provider={game.provider}
            badge={game.badge}
            rtp={mockRtp(game.id)}
            onPlay={onSelect}
            onDemo={onSelect}
            className="w-32 shrink-0 sm:w-36 md:w-[174px]"
            sizes="174px"
          />
        ))}
      </div>
    </section>
  )
}
