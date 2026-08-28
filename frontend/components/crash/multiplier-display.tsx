"use client"

import { cn } from "@/lib/utils"
import { formatMultiplier } from "@/lib/currency"
import type { CrashGame } from "@/lib/types"
import { CrashGraph } from "./crash-graph"

interface MultiplierDisplayProps {
  game: CrashGame | null
  liveMultiplier: number
  connected: boolean
}

export function MultiplierDisplay({ game, liveMultiplier, connected }: MultiplierDisplayProps) {
  const state = game?.state
  const isRolling = state === "rolling"
  const isCompleted = state === "completed"
  const isWaiting = state === "created" || state === "pending" || state === undefined

  return (
    <div className="relative flex aspect-[16/10] w-full flex-col items-center justify-center overflow-hidden rounded-2xl border border-border bg-card md:aspect-[16/8]">
      <CrashGraph state={state} multiplier={isCompleted ? game?.outcome ?? liveMultiplier : liveMultiplier} startedAt={game?.updatedAt ?? null} />

      <div className="relative z-10 flex flex-col items-center gap-2">
        {isWaiting ? (
          <>
            <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Sonraki tur
            </span>
            <span className="text-3xl font-bold text-foreground md:text-4xl">Hazırlanıyor…</span>
          </>
        ) : (
          <>
            <span
              className={cn(
                "text-5xl font-bold tabular md:text-7xl",
                isCompleted ? "text-destructive" : "text-accent",
              )}
            >
              {formatMultiplier(isCompleted ? game?.outcome ?? liveMultiplier : liveMultiplier)}
            </span>
            {isCompleted && (
              <span className="text-sm font-medium text-muted-foreground">Uçtu — tur bitti</span>
            )}
          </>
        )}
      </div>

      {!connected && (
        <div className="absolute bottom-3 right-3 z-10 rounded-full bg-background/80 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
          Bağlanıyor…
        </div>
      )}
    </div>
  )
}
