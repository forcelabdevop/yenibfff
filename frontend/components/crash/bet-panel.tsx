"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { useAuth } from "@/providers/auth-provider"
import { useWallet } from "@/providers/wallet-provider"
import { formatFiat } from "@/lib/currency"
import type { CrashBet, CrashGame } from "@/lib/types"

interface BetPanelProps {
  game: CrashGame | null
  myBet: CrashBet | null
  liveMultiplier: number
  placeBet: (amount: number, autoCashout: number) => Promise<{ success: boolean; error?: { message: string } }>
  cashout: () => Promise<{ success: boolean; error?: { message: string } }>
}

const QUICK_AMOUNTS = [10, 50, 100, 500]

export function BetPanel({ game, myBet, liveMultiplier, placeBet, cashout }: BetPanelProps) {
  const { isAuthenticated } = useAuth()
  const { balance, fiat } = useWallet()
  const [amount, setAmount] = useState("10")
  const [autoCashout, setAutoCashout] = useState("")
  const [pending, setPending] = useState(false)

  const canBet = game?.state === "created" && !myBet
  const canCashout = game?.state === "rolling" && myBet && myBet.multiplier === undefined
  const alreadyCashedOut = myBet?.multiplier !== undefined

  const numericAmount = Number.parseFloat(amount)
  const isAmountValid = Number.isFinite(numericAmount) && numericAmount > 0

  async function handleBet() {
    if (!isAmountValid) {
      toast.error("Geçerli bir bahis tutarı gir.")
      return
    }
    setPending(true)
    const res = await placeBet(numericAmount, Number.parseFloat(autoCashout) || 0)
    setPending(false)
    if (!res.success) toast.error(res.error?.message ?? "Bahis başarısız.")
    else toast.success("Bahis yerleştirildi.")
  }

  async function handleCashout() {
    setPending(true)
    const res = await cashout()
    setPending(false)
    if (!res.success) toast.error(res.error?.message ?? "Cashout başarısız.")
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4">
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="crash-amount">Bahis tutarı</FieldLabel>
          <Input
            id="crash-amount"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            disabled={!canBet}
          />
          <div className="flex flex-wrap gap-1.5 pt-1">
            {QUICK_AMOUNTS.map((v) => (
              <Button
                key={v}
                type="button"
                size="sm"
                variant="secondary"
                disabled={!canBet}
                onClick={() => setAmount(String(v))}
              >
                {v}
              </Button>
            ))}
          </div>
        </Field>

        <Field>
          <FieldLabel htmlFor="crash-auto-cashout">Otomatik cashout (opsiyonel)</FieldLabel>
          <Input
            id="crash-auto-cashout"
            inputMode="decimal"
            placeholder="örn. 2.00"
            value={autoCashout}
            onChange={(e) => setAutoCashout(e.target.value)}
            disabled={!canBet}
          />
        </Field>
      </FieldGroup>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Bakiye</span>
        <span className="tabular text-foreground">{formatFiat(balance, fiat)}</span>
      </div>

      {!isAuthenticated ? (
        <Button size="lg" disabled>
          Bahis yapmak için giriş yap
        </Button>
      ) : canCashout ? (
        <Button size="lg" variant="destructive" onClick={handleCashout} disabled={pending}>
          Cashout — {(liveMultiplier / 100).toFixed(2)}x
        </Button>
      ) : alreadyCashedOut ? (
        <Button size="lg" variant="secondary" disabled>
          Cashout alındı — {((myBet?.multiplier ?? 0) / 100).toFixed(2)}x
        </Button>
      ) : myBet ? (
        <Button size="lg" variant="secondary" disabled>
          Bahis alındı — tur bekleniyor
        </Button>
      ) : (
        <Button size="lg" onClick={handleBet} disabled={!canBet || pending || !isAmountValid}>
          Bahis yap
        </Button>
      )}
    </div>
  )
}
