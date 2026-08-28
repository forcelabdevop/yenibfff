"use client"

import { GameCardShell } from "@/components/casino/game-card-shell"
import type { CasinoGame } from "@/lib/casino"

export function GameCard({
  game,
  onPlay,
  className,
}: {
  game: CasinoGame
  onPlay: (game: CasinoGame) => void
  className?: string
}) {
  return (
    <GameCardShell
      image={game.banner || game.background || ""}
      name={game.game_name}
      provider={game.provider?.name || game.provider_code || undefined}
      badge={game.featured ? "TOP" : undefined}
      onPlay={() => onPlay(game)}
      onDemo={() => onPlay(game)}
      className={className}
      sizes="(min-width: 1024px) 16vw, (min-width: 640px) 25vw, 42vw"
    />
  )
}
