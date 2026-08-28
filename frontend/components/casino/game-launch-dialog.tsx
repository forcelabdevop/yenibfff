"use client"

import { useEffect } from "react"
import { AlertTriangle, Loader2, X } from "lucide-react"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useGameLaunch } from "@/hooks/use-game-launch"
import type { CasinoGame } from "@/lib/casino"

/**
 * Seçilen oyunu gerçek sağlayıcının game_server_url'i (launch_url) ile
 * iframe içinde açmayı dener. Sağlayıcı erişilemezse (örn. eksik agent
 * kimlik bilgisi) kullanıcıya anlaşılır bir hata gösterir.
 */
export function GameLaunchDialog({
  game,
  onClose,
}: {
  game: CasinoGame | null
  onClose: () => void
}) {
  const { state, launch, reset } = useGameLaunch()

  useEffect(() => {
    if (game) void launch(game)
    else reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game])

  return (
    <Dialog
      open={!!game}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="flex h-[85vh] w-[95vw] max-w-5xl flex-col gap-0 p-0 sm:max-w-5xl"
      >
        <DialogTitle className="sr-only">{game?.game_name ?? "Oyun"}</DialogTitle>
        <DialogDescription className="sr-only">
          {game?.game_name} oyununu sağlayıcı ekranında oynuyorsun.
        </DialogDescription>

        <DialogClose className="absolute top-4 right-4 z-10 flex size-8 items-center justify-center rounded-md bg-background/80 text-muted-foreground opacity-90 ring-offset-background transition-opacity hover:opacity-100 focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-hidden">
          <X className="size-4" aria-hidden="true" />
          <span className="sr-only">Kapat</span>
        </DialogClose>

        {state.phase === "loading" && (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8">
            <Loader2 className="size-8 animate-spin text-primary" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">
              {game?.game_name} başlatılıyor…
            </p>
          </div>
        )}

        {state.phase === "error" && (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-destructive/15 text-destructive">
              <AlertTriangle className="size-6" aria-hidden="true" />
            </span>
            <div className="flex flex-col gap-1">
              <p className="text-base font-semibold text-foreground">Oyun başlatılamadı</p>
              <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
                {state.message}
              </p>
            </div>
            {game && (
              <Button size="sm" onClick={() => void launch(game)}>
                Tekrar dene
              </Button>
            )}
          </div>
        )}

        {state.phase === "ready" && (
          <iframe
            src={state.url}
            title={game?.game_name ?? "Oyun"}
            className="size-full flex-1 border-0"
            allow="autoplay; fullscreen; payment"
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
