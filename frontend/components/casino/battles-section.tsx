"use client"

import { useRef } from "react"
import Image from "next/image"
import { ChevronLeft, ChevronRight, Trophy } from "lucide-react"
import { CASINO_BATTLES } from "@/lib/casino-page"

const MEDALS = [
  "linear-gradient(135deg,#ffe466,#dc8b00)",
  "linear-gradient(135deg,#e8ebff,#7d82a8)",
  "linear-gradient(135deg,#ffbc86,#9d4f28)",
]

export function BattlesSection({ onParticipate }: { onParticipate: () => void }) {
  const scrollerRef = useRef<HTMLDivElement>(null)

  function scrollByPage(direction: -1 | 1) {
    scrollerRef.current?.scrollBy({ left: direction * 390, behavior: "smooth" })
  }

  return (
    <section aria-labelledby="battles-title" className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Trophy className="size-6 text-muted-foreground" aria-hidden="true" />
          <h2 id="battles-title" className="text-xl font-extrabold text-foreground sm:text-2xl">
            Savaşlar &amp; Turnuvalar
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => scrollByPage(-1)} aria-label="Turnuvaları sola kaydır" className="inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">
            <ChevronLeft className="size-6" aria-hidden="true" />
          </button>
          <button type="button" onClick={() => scrollByPage(1)} aria-label="Turnuvaları sağa kaydır" className="inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">
            <ChevronRight className="size-6" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div ref={scrollerRef} className="scrollbar-hidden flex snap-x snap-mandatory gap-4 overflow-x-auto pb-1">
        {CASINO_BATTLES.map((battle) => (
          <article key={battle.id} className="flex w-[92%] shrink-0 snap-start flex-col overflow-hidden rounded-xl bg-[#1b2737] sm:w-[420px] lg:w-[390px]">
            <div className="relative h-[292px] shrink-0 overflow-hidden" style={{ backgroundImage: battle.gradient }}>
              <Image src={battle.image} alt="" fill sizes="420px" className="object-cover" />
              <div className="absolute inset-0 bg-gradient-to-r from-[#240b18]/80 via-transparent to-transparent" aria-hidden="true" />
              <div className="absolute inset-x-5 top-6 flex flex-col items-start gap-5">
                <span className="inline-flex items-center gap-2 rounded-md bg-foreground/20 px-2.5 py-1.5 text-sm font-extrabold text-foreground backdrop-blur-md">
                  {battle.countdownLabel ? <><span>{battle.countdownLabel}</span><span className="h-4 w-px bg-foreground/30" aria-hidden="true" /></> : null}
                  <span className="font-mono tabular-nums">{battle.countdown}</span>
                </span>
                <h3 className="max-w-[58%] text-pretty text-2xl font-extrabold leading-[1.15] text-foreground">{battle.title}</h3>
              </div>

              <div className="absolute bottom-10 left-5 flex items-end gap-2">
                <div className="relative flex min-h-[58px] items-center gap-2 rounded-lg bg-foreground px-3 text-background shadow-lg">
                  <span className="text-[10px] font-black uppercase leading-[1.05]">ÖDÜL<br />HAVUZU</span>
                  <strong className="font-mono text-2xl font-black tracking-tight">{battle.prize}</strong>
                  {battle.tag?.includes("BONUS") ? <span className="absolute -right-1 -top-3 rounded-full bg-primary px-2.5 py-1 text-[10px] font-black text-primary-foreground">{battle.tag}</span> : null}
                </div>
                {battle.tag && !battle.tag.includes("BONUS") ? <span className="rounded-full bg-primary px-4 py-2 text-sm font-black uppercase text-primary-foreground">{battle.tag}</span> : null}
              </div>
            </div>

            <div className="flex min-h-[315px] flex-1 flex-col px-4 pb-4 pt-5">
              <div className="grid grid-cols-[48px_1fr_auto] border-b border-[#304053] pb-3 text-xs font-bold text-[#71839d]">
                <span>{battle.columns[0]}</span><span>{battle.columns[1]}</span><span>{battle.columns[2]}</span>
              </div>

              <div className="flex flex-1 flex-col">
                {battle.rows.map((row, index) => (
                  <div key={`${battle.id}-${row.place}`} className="grid min-h-[70px] grid-cols-[48px_1fr_auto] items-center border-b border-[#304053] py-2 last:border-b-0">
                    <span className="relative inline-flex size-8 items-center justify-center rounded-full font-mono text-sm font-black text-background shadow" style={{ backgroundImage: MEDALS[index] }}>
                      {row.place}
                    </span>
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-[#68d7ef] text-xs font-black text-[#152232]">{row.player.slice(0, 1).toUpperCase()}</span>
                      <span className="min-w-0">
                        <strong className="block truncate text-sm font-bold text-foreground">{row.player}</strong>
                        <span className="block truncate font-mono text-xs font-semibold text-[#91a2bb]">{row.value}</span>
                      </span>
                    </span>
                    <strong className="max-w-[112px] text-right font-mono text-sm font-extrabold leading-tight text-foreground">{row.prize}</strong>
                  </div>
                ))}
              </div>

              <button type="button" onClick={onParticipate} className="btn-3d-primary mt-3 min-h-12 w-full rounded-lg px-4 text-sm font-extrabold text-primary-foreground shadow-[0_0_22px_rgba(244,14,69,0.35)]">
                Kaydol &amp; Katıl
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
