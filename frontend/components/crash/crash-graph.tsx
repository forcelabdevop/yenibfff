"use client"

import { useEffect, useRef, useState } from "react"
import type { CrashGameState } from "@/lib/types"

interface CrashGraphProps {
  state: CrashGameState | undefined
  multiplier: number
  startedAt: number | null
}

const WIDTH = 100
const HEIGHT = 100
/** Grafiği okunur tutmak için görünür pencere — çarpan bu değeri geçtikçe kayar. */
const MULTIPLIER_CEILING = 300

/**
 * Backend formülü (utils/crash.js → crashGetGameMultiplier) baz alınarak
 * anlık çarpandan bir eğri noktası üretir; elle çizilmiş bir SVG path değil,
 * gerçek matematiksel fonksiyonun örneklemesidir.
 */
function pointsForMultiplier(current: number, ceiling: number) {
  const steps = 40
  const points: [number, number][] = []
  for (let i = 0; i <= steps; i++) {
    const m = 100 + ((current - 100) * i) / steps
    if (m > current) break
    const x = (i / steps) * WIDTH
    const progress = Math.min(1, (m - 100) / (ceiling - 100))
    const y = HEIGHT - progress * HEIGHT
    points.push([x, y])
  }
  return points
}

export function CrashGraph({ state, multiplier }: CrashGraphProps) {
  const [ceiling, setCeiling] = useState(MULTIPLIER_CEILING)

  useEffect(() => {
    if (state === "created" || state === "pending") setCeiling(MULTIPLIER_CEILING)
    else if (multiplier > ceiling * 0.85) setCeiling((c) => c * 1.6)
  }, [multiplier, state, ceiling])

  const isRolling = state === "rolling"
  const isCompleted = state === "completed"
  const points = isRolling || isCompleted ? pointsForMultiplier(multiplier, ceiling) : []
  const path = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`).join(" ")
  const last = points[points.length - 1]

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      preserveAspectRatio="none"
      className="absolute inset-0 h-full w-full"
      aria-hidden
    >
      <defs>
        <linearGradient id="crash-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={isCompleted ? "var(--color-destructive)" : "var(--color-accent)"} stopOpacity="0.35" />
          <stop offset="100%" stopColor={isCompleted ? "var(--color-destructive)" : "var(--color-accent)"} stopOpacity="0" />
        </linearGradient>
      </defs>

      {points.length > 1 && (
        <>
          <path d={`${path} L${last[0].toFixed(2)},${HEIGHT} L0,${HEIGHT} Z`} fill="url(#crash-fill)" />
          <path
            d={path}
            fill="none"
            stroke={isCompleted ? "var(--color-destructive)" : "var(--color-accent)"}
            strokeWidth="1.5"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          {!isCompleted && last && (
            <circle cx={last[0]} cy={last[1]} r="1.8" fill="var(--color-accent)" />
          )}
        </>
      )}
    </svg>
  )
}
