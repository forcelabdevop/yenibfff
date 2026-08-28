"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { backendUrl } from "@/lib/config"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { formatMultiplier } from "@/lib/currency"
import { cn } from "@/lib/utils"
import type { CrashBet } from "@/lib/types"
import { Users } from "lucide-react"

interface LiveBetsProps {
  bets: CrashBet[]
  myUserId?: string
}

export function LiveBets({ bets, myUserId }: LiveBetsProps) {
  const sorted = [...bets].sort((a, b) => b.amount - a.amount)

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Bu turdaki bahisler</h2>
        <span className="text-xs text-muted-foreground">{bets.length}</span>
      </div>

      {sorted.length === 0 ? (
        <Empty className="py-6">
          <EmptyMedia variant="icon">
            <Users />
          </EmptyMedia>
          <EmptyTitle>Henüz bahis yok</EmptyTitle>
          <EmptyDescription>Bu tur için ilk bahsi sen yerleştir.</EmptyDescription>
        </Empty>
      ) : (
        <ScrollArea className="h-72">
          <div className="flex flex-col gap-2 pr-2">
            {sorted.map((bet) => {
              const cashedOut = bet.multiplier !== undefined
              const isMe = bet.user._id === myUserId
              return (
                <div
                  key={bet._id}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border border-transparent px-2 py-1.5",
                    isMe && "border-primary/40 bg-primary/5",
                  )}
                >
                  <Avatar className="size-7">
                    <AvatarImage src={bet.user.avatar ? backendUrl(bet.user.avatar) : "/placeholder.svg"} alt={bet.user.username} />
                    <AvatarFallback className="text-[11px]">
                      {bet.user.username.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="flex-1 truncate text-sm text-foreground">{bet.user.username}</span>
                  <span className="tabular text-sm text-muted-foreground">{bet.amount.toFixed(2)}</span>
                  {cashedOut ? (
                    <Badge className="bg-accent text-accent-foreground">
                      {formatMultiplier(bet.multiplier!)}
                    </Badge>
                  ) : (
                    <Badge variant="secondary">Beklemede</Badge>
                  )}
                </div>
              )
            })}
          </div>
        </ScrollArea>
      )}
    </div>
  )
}
