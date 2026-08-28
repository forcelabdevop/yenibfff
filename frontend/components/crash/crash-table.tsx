"use client"

import { useCrash } from "@/hooks/use-crash"
import { useAuth } from "@/providers/auth-provider"
import { MultiplierDisplay } from "./multiplier-display"
import { BetPanel } from "./bet-panel"
import { LiveBets } from "./live-bets"
import { HistoryStrip } from "./history-strip"

export function CrashTable() {
  const { game, bets, history, liveMultiplier, connected, myBet, placeBet, cashout } = useCrash()
  const { user } = useAuth()

  return (
    <div className="flex flex-col gap-4">
      <HistoryStrip history={history} />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex flex-col gap-4">
          <MultiplierDisplay game={game} liveMultiplier={liveMultiplier} connected={connected} />
          <div className="md:hidden">
            <BetPanel game={game} myBet={myBet} liveMultiplier={liveMultiplier} placeBet={placeBet} cashout={cashout} />
          </div>
          <LiveBets bets={bets} myUserId={user?._id} />
        </div>

        <div className="hidden md:block">
          <BetPanel game={game} myBet={myBet} liveMultiplier={liveMultiplier} placeBet={placeBet} cashout={cashout} />
        </div>
      </div>
    </div>
  )
}
