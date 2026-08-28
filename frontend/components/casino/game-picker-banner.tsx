"use client"

import Image from "next/image"
import { RefreshCw } from "lucide-react"
import { WEBSITE_NAME } from "@/lib/config"

const A = "/casino-assets"

const COLUMNS = [
  [
    ["Cryptos", `${A}/original-cryptos.jpeg`],
    ["Ring", `${A}/original-ring.jpeg`],
    ["Dice", `${A}/original-dice.jpeg`],
  ],
  [
    [`${WEBSITE_NAME} Million`, `${A}/slot-gates-of-olympus.jpeg`],
    ["Plinko", `${A}/original-plinko.jpeg`],
    ["Crash", `${A}/original-crash.jpeg`],
  ],
  [
    ["Blackjack", `${A}/original-blackjack.jpeg`],
    ["Bac Bo", `${A}/slot-bac-bo.jpeg`],
    ["Roulette", `${A}/original-roulette.jpeg`],
  ],
] as const

export function GamePickerBanner({ onSpin }: { onSpin: () => void }) {
  return (
    <section
      aria-labelledby="game-picker-title"
      className="relative isolate min-h-[500px] overflow-hidden rounded-xl border border-[#243a69] bg-[#0b1230] sm:min-h-[620px] lg:min-h-[660px]"
    >
      <Image
        src="/banners/game-picker-scene.png"
        alt=""
        fill
        sizes="(min-width: 1024px) 1066px, 100vw"
        className="-z-20 object-cover"
      />
      <div className="absolute inset-0 -z-10 bg-[#07102b]/35" aria-hidden="true" />

      <div className="mx-auto my-5 flex min-h-[458px] w-[90%] max-w-[790px] flex-col items-center rounded-[28px] border border-[#284377] bg-[#183363]/90 px-4 pb-12 pt-10 shadow-[0_24px_70px_rgba(3,9,30,0.55)] backdrop-blur-sm sm:my-8 sm:min-h-[550px] sm:px-8 sm:pt-12 lg:max-w-[820px]">
        <h2
          id="game-picker-title"
          className="text-center text-2xl font-extrabold leading-tight tracking-tight text-foreground sm:text-4xl lg:text-[42px]"
        >
          Oyun seçmekte yardıma mı ihtiyacın var?{" "}
          <span className="text-primary">oyun?</span>
        </h2>

        <div className="relative mt-8 h-[310px] w-full max-w-[680px] overflow-hidden rounded-[30px] border-[12px] border-[#07131e]/90 bg-[#091523] p-2 shadow-[inset_0_0_0_1px_rgba(107,153,196,0.25)] sm:mt-11 sm:h-[390px] sm:p-3">
          <div className="grid h-full grid-cols-3 gap-2 overflow-hidden rounded-xl sm:gap-3">
            {COLUMNS.map((column, columnIndex) => (
              <div key={columnIndex} className="flex min-w-0 flex-col gap-2 sm:gap-3">
                {column.map(([name, src]) => (
                  <div key={name} className="relative min-h-[132px] flex-1 overflow-hidden rounded-xl bg-[#131d2a]">
                    <Image src={src} alt="" fill sizes="220px" className="object-cover" />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#08111b] to-transparent px-2 pb-2 pt-8 text-center text-[10px] font-medium uppercase tracking-wide text-foreground/75 sm:text-xs">
                      {name}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>

          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-3 top-1/2 h-[36%] -translate-y-1/2 rounded-[22px] border-[5px] border-[#a3d7ff] shadow-[0_0_9px_3px_rgba(92,183,255,0.95),inset_0_0_8px_rgba(92,183,255,0.9)]"
          />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-[32%] bg-gradient-to-b from-[#06101d]/95 to-transparent" aria-hidden="true" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[28%] bg-gradient-to-t from-[#06101d]/95 to-transparent" aria-hidden="true" />
        </div>

        <button
          type="button"
          onClick={onSpin}
          className="btn-3d-primary relative z-10 -mt-7 inline-flex min-h-14 items-center gap-3 rounded-xl px-8 text-lg font-extrabold text-primary-foreground shadow-[0_12px_30px_rgba(244,14,69,0.45)] sm:min-h-16 sm:px-10 sm:text-xl"
        >
          <RefreshCw className="size-6" aria-hidden="true" />
          Kaydol &amp; Çevir
        </button>
      </div>
    </section>
  )
}
