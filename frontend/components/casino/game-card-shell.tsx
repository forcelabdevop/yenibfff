"use client"

import { useState } from "react"
import { Heart, Info, Play } from "lucide-react"
import { GameThumb } from "@/components/casino/game-thumb"
import { cn } from "@/lib/utils"

/**
 * referans casino arayüzü oyun kartının birebir görsel klonu.
 *
 * Ölçüler referans karttan (174x230, hover 182x240) alınmıştır:
 * - köşe yarıçapı 14px, hover'da kart 1.045 oranında büyür
 * - hover örtüsü: sol üstte RTP, sağ üstte bilgi ikonu, ortada 68px kırmızı
 *   oynat düğmesi, altında altı çizili "Demo Play", en altta ad/sağlayıcı
 *   ve sağda favori kalbi
 * - hover dışında: sol üstte TOP/HOT rozeti, altta ortalanmış sağlayıcı adı
 */
export function GameCardShell({
  image,
  name,
  provider,
  badge,
  rtp,
  onPlay,
  onDemo,
  className,
  sizes = "180px",
}: {
  image: string
  name: string
  provider?: string
  badge?: string
  rtp?: number
  onPlay: () => void
  onDemo?: () => void
  className?: string
  sizes?: string
}) {
  const [favorite, setFavorite] = useState(false)

  return (
    <div
      className={cn(
        "group relative aspect-[182/240] overflow-hidden rounded-[14px] bg-card transition-transform duration-200 hover:scale-[1.045] focus-within:scale-[1.045]",
        className,
      )}
    >
      {/* Kapak görseli oyunun adını zaten içerdiği için alt="" (dekoratif);
          erişilebilir ad, kartı kaplayan oynat düğmesinden gelir. Yedek görsel
          seçimi ad + sağlayıcıya göre yapılır, böylece kapağı eksik oyunlar
          birbirinin kopyası gibi görünmez. */}
      <GameThumb src={image} alt="" fallbackKey={`${name}${provider ?? ""}`} sizes={sizes} />

      {/* Varsayılan alt karartma */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background/85 via-transparent to-transparent" />

      {/* Hover örtüsü */}
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,color-mix(in_oklab,var(--color-primary)_24%,transparent)_0%,color-mix(in_oklab,var(--color-background)_18%,transparent)_38%,color-mix(in_oklab,var(--color-background)_94%,var(--color-primary)_6%)_100%)] opacity-0 backdrop-blur-[1px] transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100" />

      {/* Kartın tamamı ana oynat düğmesi */}
      <button
        type="button"
        onClick={onPlay}
        aria-label={`${name} oyna`}
        className="absolute inset-0 z-10 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      />

      {/* Varsayılan durum: rozet + sağlayıcı */}
      {badge ? (
        <span className="pointer-events-none absolute left-[7px] top-[7px] z-20 rounded-full bg-primary px-2.5 py-1 text-[11px] font-bold uppercase leading-none tracking-wide text-primary-foreground opacity-100 transition-opacity duration-200 group-hover:opacity-0 group-focus-within:opacity-0">
          {badge}
        </span>
      ) : null}

      {provider ? (
        /* Kapak görselleri kendi oyun adlarını içerdiğinden, sağlayıcı yazısı
           doğrudan görselin üstünde okunmuyordu; ince bir zemin ekleniyor. */
        <span className="pointer-events-none absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-background/95 to-transparent px-2 pb-2 pt-5 opacity-100 transition-opacity duration-200 group-hover:opacity-0 group-focus-within:opacity-0">
          <span className="block truncate text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {provider}
          </span>
        </span>
      ) : null}

      {/* Hover: RTP + görsel oynat düğmesi */}
      <div className="pointer-events-none absolute inset-0 z-20 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100">
        {typeof rtp === "number" ? (
          <span className="absolute left-[7px] top-[10px] text-xs font-semibold text-muted-foreground">
            {rtp.toFixed(2)}% RTP
          </span>
        ) : null}

        <span
          className="absolute left-1/2 top-[36%] flex aspect-square w-[38%] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-primary shadow-[0_7px_0_color-mix(in_oklab,var(--color-primary)_68%,var(--color-background)),0_13px_22px_color-mix(in_oklab,var(--color-primary)_48%,transparent),inset_0_2px_2px_color-mix(in_oklab,var(--color-primary-foreground)_55%,transparent)]"
          style={{ background: "linear-gradient(180deg, color-mix(in oklab, var(--color-primary) 72%, var(--color-primary-foreground)) 0%, var(--color-primary) 48%, color-mix(in oklab, var(--color-primary) 82%, var(--color-background)) 100%)" }}
        >
          <Play className="ml-1 size-[37%] fill-primary-foreground text-primary-foreground" strokeWidth={1.5} aria-hidden="true" />
        </span>
      </div>

      {/* Hover: bilgi ikonu */}
      <button
        type="button"
        aria-label={`${name} hakkında bilgi`}
        onClick={(event) => event.stopPropagation()}
        className="absolute right-[7px] top-[6px] z-30 hidden size-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground group-hover:flex group-focus-within:flex"
      >
        <Info className="size-5" aria-hidden="true" />
      </button>

      {/* Hover: Demo Play */}
      {onDemo ? (
        <button
          type="button"
          onClick={onDemo}
          className="absolute inset-x-0 top-[64%] z-30 hidden justify-center text-[15px] font-semibold leading-5 text-accent underline decoration-2 underline-offset-2 transition-colors hover:text-foreground group-hover:flex group-focus-within:flex"
        >
          Demo Play
        </button>
      ) : null}

      {/* Hover: ad + sağlayıcı + favori */}
      <div className="absolute inset-x-3 bottom-3 z-30 hidden items-end justify-between gap-2 group-hover:flex group-focus-within:flex">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold leading-5 text-foreground">{name}</span>
          {provider ? (
            <span className="block truncate text-sm font-medium leading-5 text-muted-foreground">{provider}</span>
          ) : null}
        </span>
        <button
          type="button"
          aria-label={favorite ? `${name} favorilerden çıkar` : `${name} favorilere ekle`}
          aria-pressed={favorite}
          onClick={() => setFavorite((value) => !value)}
          className="shrink-0 text-primary transition-transform hover:scale-110"
        >
          <Heart className={cn("size-6", favorite && "fill-current")} aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}
