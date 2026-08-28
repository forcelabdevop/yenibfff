"use client"

import { useState } from "react"
import Image from "next/image"
import { cn } from "@/lib/utils"
import { backendUrl } from "@/lib/config"

const A = "/casino-assets"

/**
 * Canlı API oyun kayıtları `/uploads/games/*.webp` bannerları döndürüyor, ancak
 * bu görseller her ortamda yayınlanmış olmuyor. Tek bir jenerik görsele düşmek
 * koca rafların birbirinin kopyası gibi görünmesine yol açıyordu; bunun yerine
 * gerçek yerel kapaklardan oluşan bir havuzdan deterministik olarak seçim
 * yapıyoruz.
 */
const FALLBACK_POOL = [
  "slot-sugar-rush-super-scatter",
  "slot-sweet-bonanza-2500",
  "slot-merge-up",
  "slot-clash-of-gods",
  "slot-starlight-princess-1000",
  "slot-gates-of-olympus",
  "slot-burning-coins-100",
  "slot-alien-fruits",
  "slot-danludans-fortune-bass",
  "slot-lady-wolf-moon",
  "slot-wild-zombies",
  "slot-sons-of-monarchy",
  "slot-death-becomes-you",
  "slot-blazing-coins",
  "slot-beauty-and-the-beast",
  "slot-le-bunny",
  "slot-big-bang",
  "slot-dogmasons-megawoof",
  "slot-le-football-fan",
  "slot-baba-yaga-tales",
  "original-roulette",
  "original-blackjack",
  "slot-blackjack-26",
  "slot-bac-bo",
  "original-keno",
  "original-hilo",
  "original-ring",
  "original-circle",
]

/** Masa oyunları slot kapağı almasın diye tematik alt havuzlar. */
const ROULETTE_POOL = ["original-roulette", "original-ring", "original-circle"]
const BLACKJACK_POOL = ["original-blackjack", "slot-blackjack-26", "slot-bac-bo"]

/** Anahtardan havuz indeksine deterministik eşleme (sunucu/istemci uyumlu). */
function pickFallback(key: string): string {
  const lower = key.toLowerCase()
  const pool = /roulette|rulet/.test(lower)
    ? ROULETTE_POOL
    : /blackjack|baccarat|bac bo|poker/.test(lower)
      ? BLACKJACK_POOL
      : FALLBACK_POOL

  let hash = 0
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) % 100000
  }
  return `${A}/${pool[hash % pool.length]}.jpeg`
}

export function GameThumb({
  src,
  alt,
  fallbackKey,
  className,
  sizes,
}: {
  src?: string | null
  alt: string
  /** Yedek kapak seçimi için sabit anahtar (genelde oyun adı + sağlayıcı). */
  fallbackKey?: string
  className?: string
  sizes?: string
}) {
  const [failed, setFailed] = useState(false)

  // Yedek görsel anahtara göre sabitlenir; böylece aynı kart her zaman aynı
  // kapağı gösterir ama komşu kartlar birbirinden farklı görünür. Kapak
  // dekoratif olduğunda alt="" olur, bu yüzden anahtar ayrıca verilir.
  const fallback = pickFallback(fallbackKey || alt || "game")
  const resolved = !src || failed ? fallback : backendUrl(src)

  return (
    <Image
      src={resolved}
      alt={alt}
      fill
      sizes={sizes ?? "(min-width: 1024px) 16vw, (min-width: 640px) 25vw, 42vw"}
      className={cn("object-cover", className)}
      onError={() => setFailed(true)}
    />
  )
}
