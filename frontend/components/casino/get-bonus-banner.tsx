"use client"

import Image from "next/image"
import { ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { BONUS_TIERS } from "@/lib/casino-page"

/**
 * referans casino arayüzü'daki "GET BONUS 590%" bannerının birebir karşılığı.
 *
 * Ölçüler canlı referanstan alındı (1066x228 panel, 18px yarıçap, 229x181
 * kartlar, 12px kart yarıçapı ve 12px iç boşluk).
 *
 * Önemli ayrıntı: referansta üç kartın gradyanı ve butonu birebir AYNIdır.
 * 2. ve 3. kartın sönük görünmesi ayrı renklerden değil, kart sarmalayıcısına
 * uygulanan `opacity: .6`dan gelir; bu yüzden metinler burada da tam kontrastta
 * bırakılıp sönükleştirme tek bir opaklıkla yapılıyor.
 */

/** Panel zemini: koyu lacivert taban + sağ altta güçlü, sol üstte hafif mavi ışıma. */
const PANEL_BG = [
  "radial-gradient(49.16% 93.01% at 105.72% 96.74%, rgba(39, 125, 243, 0.8) 0%, rgba(18, 26, 36, 0) 100%)",
  "radial-gradient(94.27% 86.34% at 0% -14.91%, rgba(39, 125, 243, 0.4) 0%, rgba(18, 26, 36, 0) 100%)",
].join(", ")

/** Kart zemini: üstten aşağı açılan mavi radyal gradyan. */
const CARD_BG =
  "radial-gradient(117.84% 117.24% at 50% -20.4%, #0176b6 0%, #014186 41.31%, #011a53 100%)"

export function GetBonusBanner({ onSignUp }: { onSignUp: () => void }) {
  return (
    <section
      aria-label="Hoş geldin bonusu"
      className="relative overflow-hidden rounded-[18px] px-4 py-5 md:px-8 md:py-6"
      style={{ backgroundColor: "#111923", backgroundImage: PANEL_BG }}
    >
      <Image
        src="/banners/mascot.png"
        alt=""
        width={320}
        height={320}
        className="pointer-events-none absolute -bottom-4 right-0 hidden h-[112%] w-auto object-contain xl:block"
      />

      <div className="relative flex flex-col gap-5 md:flex-row md:items-center md:gap-4 xl:pr-40">
        <div className="shrink-0 text-center md:w-[170px] md:text-left lg:w-[220px]">
          <p className="text-[26px] font-black uppercase leading-none tracking-tight md:text-[40px] md:leading-[0.95] md:tracking-[0.8px]">
            <span className="text-primary md:hidden">Bonus Al </span>
            <span className="hidden text-primary md:inline">Bonus<br />Al<br /></span>
            <span className="text-foreground">%590</span>
          </p>
          <p className="mt-2 text-sm font-semibold tracking-[-0.32px] text-muted-foreground md:mt-3 md:text-base">
            10.500₺&apos;ye kadar
          </p>
          <button
            type="button"
            onClick={onSignUp}
            className="mt-2 hidden items-center gap-1 text-sm font-semibold tracking-[-0.28px] text-accent transition-opacity hover:opacity-80 md:inline-flex"
          >
            Detayları gör
            <ChevronRight className="size-4" aria-hidden="true" />
          </button>
        </div>

        <div className="scrollbar-hidden -mx-4 flex min-w-0 snap-x snap-mandatory gap-3 overflow-x-auto px-4 sm:mx-0 sm:grid sm:flex-1 sm:grid-cols-3 sm:overflow-visible sm:px-0 lg:gap-[18px]">
          {BONUS_TIERS.map((tier) => (
            <div
              key={tier.id}
              className={cn("w-[84%] shrink-0 snap-start sm:w-auto", !tier.highlighted && "opacity-60")}
            >
              <div
                className="flex h-full flex-col gap-2 rounded-xl p-3 text-center"
                style={{ backgroundImage: CARD_BG }}
              >
                <span className="flex items-center justify-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.66px] text-[#a7b5ca]">
                  {tier.label}
                  {tier.highlighted ? (
                    <span
                      aria-hidden="true"
                      className="flex size-4 items-center justify-center rounded-full border border-[#a7b5ca]/60 text-[9px] font-bold leading-none"
                    >
                      i
                    </span>
                  ) : null}
                </span>

                <div>
                  <span className="tabular block text-[32px] font-bold leading-none tracking-[-0.64px] text-white">
                    {tier.percent}
                  </span>
                  <span className="mt-1 block text-sm font-semibold tracking-[-0.28px] text-[#a7b5ca]">
                    Bonus
                  </span>
                </div>

                <span aria-hidden="true" className="h-px w-full bg-white/10" />

                <span className="flex items-center justify-center gap-2 text-xs font-semibold tracking-[-0.24px] text-white">
                  <Image
                    src="/banners/fs-badge.png"
                    alt=""
                    width={24}
                    height={24}
                    className="size-6 shrink-0"
                  />
                  + {tier.freeSpins}
                </span>

                <button
                  type="button"
                  onClick={onSignUp}
                  className="mt-auto h-[33px] w-full rounded-lg text-xs font-semibold tracking-[-0.24px] text-white transition-opacity hover:opacity-90"
                  style={{
                    backgroundImage: "linear-gradient(360deg, #c4003b 0.8%, #fb1949 100%)",
                    boxShadow:
                      "0 3px 16px rgba(255, 35, 65, 0.5), inset 0 4px 3px rgba(255, 255, 255, 0.3)",
                  }}
                >
                  Kaydol &amp; Al
                </button>
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={onSignUp}
          className="mx-auto inline-flex items-center gap-1 text-sm font-semibold text-accent md:hidden"
        >
          Detayları gör
          <ChevronRight className="size-4" aria-hidden="true" />
        </button>
      </div>
    </section>
  )
}
