"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { CASINO_PROMOS } from "@/lib/casino-page"

/**
 * referans casino arayüzü'nun en üstündeki promo carousel'i.
 *
 * Referansta 1198px viewport'ta aynı anda 3 kart görünür (344 × 190 px,
 * aralarında 16px boşluk), altında sayfa nokta göstergeleri ve iki yön oku
 * bulunur. Kaydırma scroll-snap ile yapılır; noktalar görünür ilk karta göre
 * güncellenir.
 */
export function CasinoPromoCarousel() {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(0)

  const syncActive = useCallback(() => {
    const el = scrollerRef.current
    if (!el) return
    const card = el.firstElementChild as HTMLElement | null
    if (!card) return
    const step = card.offsetWidth + 16
    setActive(Math.round(el.scrollLeft / step))
  }, [])

  useEffect(() => {
    const el = scrollerRef.current
    if (!el) return
    el.addEventListener("scroll", syncActive, { passive: true })
    return () => el.removeEventListener("scroll", syncActive)
  }, [syncActive])

  function scrollToIndex(index: number) {
    const el = scrollerRef.current
    if (!el) return
    const card = el.firstElementChild as HTMLElement | null
    if (!card) return
    const clamped = Math.max(0, Math.min(index, CASINO_PROMOS.length - 1))
    el.scrollTo({ left: clamped * (card.offsetWidth + 16), behavior: "smooth" })
  }

  return (
    <section aria-label="Kampanyalar" className="flex flex-col gap-3">
      <div
        ref={scrollerRef}
        className="scrollbar-hidden flex snap-x snap-mandatory gap-4 overflow-x-auto"
      >
        {CASINO_PROMOS.map((promo) => (
          <Link
            key={promo.id}
            href={promo.href}
            style={{ backgroundImage: promo.gradient }}
            className="relative flex aspect-[344/190] w-[85%] shrink-0 snap-start flex-col justify-center overflow-hidden rounded-[18px] px-5 sm:w-[calc((100%-16px)/2)] md:w-[calc((100%-16px)/2)] xl:w-[calc((100%-32px)/3)] 2xl:w-[calc((100%-48px)/4)]"
          >
            <Image
              src={promo.image || "/placeholder.svg"}
              alt=""
              fill
              sizes="(min-width: 1024px) 360px, (min-width: 640px) 50vw, 85vw"
              className="pointer-events-none absolute inset-y-0 left-[42%] w-[58%] object-cover object-center opacity-90 mix-blend-lighten"
            />
            <div
              className="pointer-events-none absolute inset-0"
              style={{ backgroundImage: "linear-gradient(90deg, rgba(10,6,14,0.82) 8%, rgba(10,6,14,0.25) 62%, rgba(10,6,14,0) 100%)" }}
            />

            <div className="relative flex max-w-[62%] flex-col items-start gap-2">
              {promo.flag ? (
                <span className="rounded-md bg-[rgba(255,255,255,0.16)] px-2 py-1 text-[10px] font-bold uppercase leading-none tracking-wide text-foreground backdrop-blur-sm">
                  {promo.flag}
                </span>
              ) : null}

              <h3 className="text-pretty text-lg font-extrabold uppercase leading-tight tracking-tight text-foreground sm:text-xl">
                {promo.title}
              </h3>

              {promo.subtitle ? (
                <p className="text-xs font-medium text-foreground/80">{promo.subtitle}</p>
              ) : null}

              {promo.rank ? <p className="text-xs font-medium text-foreground/80">{promo.rank}</p> : null}

              {promo.prize ? (
                <span className="mt-1 inline-flex items-center gap-2 rounded-lg bg-[rgba(8,6,12,0.55)] px-3 py-1.5 backdrop-blur-sm">
                  <span className="text-[9px] font-bold uppercase leading-[1.1] text-foreground/70">
                    ÖDÜL
                    <br />
                    HAVUZU
                  </span>
                  <span className="tabular text-xl font-extrabold leading-none text-foreground">{promo.prize}</span>
                  {promo.prizeExtra ? (
                    <span className="btn-3d-primary rounded-full px-2 py-0.5 text-[9px] font-bold leading-none text-primary-foreground">
                      {promo.prizeExtra}
                    </span>
                  ) : null}
                </span>
              ) : null}
            </div>
          </Link>
        ))}
      </div>

      <div className="flex items-center justify-center gap-3">
        <CarouselArrow
          direction="left"
          label="Önceki kampanya"
          disabled={active <= 0}
          onClick={() => scrollToIndex(active - 1)}
        />

        <div className="flex items-center gap-1.5">
          {CASINO_PROMOS.map((promo, index) => (
            <button
              key={promo.id}
              type="button"
              aria-label={`${index + 1}. kampanyaya git`}
              aria-current={index === active}
              onClick={() => scrollToIndex(index)}
              className={cn(
                "h-1 rounded-full transition-all",
                index === active ? "w-8 bg-foreground" : "w-5 bg-muted-foreground/35 hover:bg-muted-foreground/60",
              )}
            />
          ))}
        </div>

        <CarouselArrow
          direction="right"
          label="Sonraki kampanya"
          disabled={active >= CASINO_PROMOS.length - 1}
          onClick={() => scrollToIndex(active + 1)}
        />
      </div>
    </section>
  )
}

function CarouselArrow({
  direction,
  label,
  disabled,
  onClick,
}: {
  direction: "left" | "right"
  label: string
  disabled: boolean
  onClick: () => void
}) {
  const Chevron = direction === "left" ? ChevronLeft : ChevronRight

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="inline-flex size-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
    >
      <Chevron className="size-4" aria-hidden="true" />
    </button>
  )
}
