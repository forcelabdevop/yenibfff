"use client"

import { formatMultiplier } from "@/lib/currency"
import { cn } from "@/lib/utils"
import type { CrashGame } from "@/lib/types"

interface HistoryStripProps {
  history: CrashGame[]
}

export function HistoryStrip({ history }: HistoryStripProps) {
  if (history.length === 0) return null

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1">
      {history.map((g) => {
        const outcome = g.outcome ?? 0
        const isLow = outcome < 200
        return (
          <span
            key={g._id}
            className={cn(
              "shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium tabular",
              isLow
                ? "border-destructive/30 bg-destructive/10 text-destructive"
                : "border-accent/30 bg-accent/10 text-accent",
            )}
          >
            {formatMultiplier(outcome)}
          </span>
        )
      })}
    </div>
  )
}
