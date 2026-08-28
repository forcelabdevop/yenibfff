/**
 * "Originals" — backend'de veritabanı Game dokümanı olmayan, her biri kendi
 * socket namespace'i ile çalışan dahili oyunlar (bkz. backend/sockets/*).
 * Liste sabit: backend/utils/userBetAccess.js içindeki "originals" kategorisi
 * ile aynı oyun setini kapsar.
 */
export interface OriginalGame {
  slug: string
  name: string
  /** Socket namespace — lib/socket.ts NAMESPACES ile eşleşir. */
  namespace: string
  image: string
  /** Sadece Crash şu an tam olarak inşa edildi. */
  live: boolean
}

export const ORIGINAL_GAMES: OriginalGame[] = [
  { slug: "crash", name: "Crash", namespace: "/crash", image: "/games/crash.png", live: true },
  { slug: "mines", name: "Mines", namespace: "/mines", image: "/games/mines.png", live: false },
  { slug: "towers", name: "Towers", namespace: "/towers", image: "/games/towers.png", live: false },
  { slug: "roll", name: "Roll", namespace: "/roll", image: "/games/roll.png", live: false },
  { slug: "blackjack", name: "Blackjack", namespace: "/blackjack", image: "/games/blackjack.png", live: false },
  { slug: "duels", name: "Duels", namespace: "/duels", image: "/games/duels.png", live: false },
  { slug: "battles", name: "Battles", namespace: "/battles", image: "/games/battles.png", live: false },
  { slug: "unbox", name: "Unbox", namespace: "/unbox", image: "/games/unbox.png", live: false },
  { slug: "upgrader", name: "Upgrader", namespace: "/upgrader", image: "/games/upgrader.png", live: false },
]
