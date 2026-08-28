"use client"

import { useRef, type ReactNode } from "react"
import {
  ChevronLeft,
  ChevronRight,
  Cherry,
  Clapperboard,
  Crown,
  Flame,
  Gem,
  Radio,
  Spade,
  Sparkles,
  Star,
  Target,
  Trophy,
  Blocks,
  Zap,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { RailIcon } from "@/lib/casino-page"

const RAIL_ICONS = {
  cherry: Cherry,
  sparkles: Sparkles,
  flame: Flame,
  radio: Radio,
  crown: Crown,
  clapperboard: Clapperboard,
  gem: Gem,
  target: Target,
  spade: Spade,
  star: Star,
  trophy: Trophy,
  blocks: Blocks,
} satisfies Record<RailIcon | "trophy" | "blocks", typeof Cherry>

export type RailShellIcon = keyof typeof RAIL_ICONS

/**
 * referans casino arayüzü'daki her yatay rafın ortak çerçevesi.
 *
 * Referans ölçüleri (1198px viewport, 1066px içerik genişliği):
 * - başlık 18px/600, solunda 20px kırmızı kategori ikonu
 * - sağda 14px/600 mavi "Tümü N" bağlantısı + iki 28px yuvarlak ok
 * - kaydırıcıda tam olarak 6 kart görünür, aralarında 16px boşluk
 *   (164px kart genişliği = (1066 - 5 × 16) / 6)
 */
export function RailShell({
  title,
  icon,
  total,
  badge,
  onSeeAll,
  children,
  className,
}: {
  title: string
  icon: RailShellIcon
  total?: number
  badge?: string
  onSeeAll?: () => void
  children: ReactNode
  className?: string
}) {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const Icon = RAIL_ICONS[icon]

  function scrollByPage(direction: -1 | 1) {
    const el = scrollerRef.current
    if (!el) return
    el.scrollBy({ left: direction * el.clientWidth * 0.9, behavior: "smooth" })
  }

  return (
    <section className={cn("flex flex-col gap-3", className)}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Icon className="size-5 shrink-0 text-primary" aria-hidden="true" />
          <h2 className="truncate text-lg font-semibold text-foreground">{title}</h2>

          {badge ? (
            <span className="hidden shrink-0 items-center gap-1.5 rounded-full bg-secondary py-1 pl-1.5 pr-3 text-xs font-semibold text-foreground sm:inline-flex">
              <span className="flex size-5 items-center justify-center rounded-full bg-primary">
                <Zap className="size-3 fill-primary-foreground text-primary-foreground" aria-hidden="true" />
              </span>
              {badge}
            </span>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {typeof total === "number" && onSeeAll ? (
            <button
              type="button"
              onClick={onSeeAll}
              className="rounded-md px-1 text-sm font-semibold text-accent transition-opacity hover:opacity-80"
            >
              Tümü {total.toLocaleString("tr-TR")}
            </button>
          ) : null}

          <RailArrow direction="left" label={`${title} rafını sola kaydır`} onClick={() => scrollByPage(-1)} />
          <RailArrow direction="right" label={`${title} rafını sağa kaydır`} onClick={() => scrollByPage(1)} />
        </div>
      </div>

      <div
        ref={scrollerRef}
        className="scrollbar-hidden -my-2 flex snap-x snap-mandatory gap-2 overflow-x-auto py-2 sm:gap-3 md:gap-4"
      >
        {children}
      </div>
    </section>
  )
}

function RailArrow({
  direction,
  label,
  onClick,
}: {
  direction: "left" | "right"
  label: string
  onClick: () => void
}) {
  const Chevron = direction === "left" ? ChevronLeft : ChevronRight

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="inline-flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
    >
      <Chevron className="size-5" aria-hidden="true" />
    </button>
  )
}

/**
 * Kaydırıcı içindeki tek kart yuvası. Genişlik yüzdeyle verilir; böylece
 * masaüstünde referanstaki gibi tam 6 kart, küçük ekranlarda kademeli olarak
 * 3–5 kart görünür.
 */
export function RailItem({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "w-[calc((100%-16px)/3)] shrink-0 snap-start",
        "sm:w-[calc((100%-36px)/4)]",
        "md:w-[calc((100%-48px)/4)]",
        "lg:w-[calc((100%-80px)/6)]",
        "2xl:w-[calc((100%-128px)/9)]",
        className,
      )}
    >
      {children}
    </div>
  )
}
