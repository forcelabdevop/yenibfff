"use client"

import { useCallback, useState } from "react"
import type { Socket } from "socket.io-client"
import { Panel, Row } from "@/components/panel"
import { useSocket } from "@/hooks/use-socket"
import { NAMESPACES } from "@/lib/socket"

export function SocketStatus() {
  const [connected, setConnected] = useState(false)
  const [online, setOnline] = useState<number | null>(null)

  const register = useCallback((socket: Socket) => {
    socket.on("connect", () => setConnected(true))
    socket.on("disconnect", () => setConnected(false))
    // backend/index.js kök bağlantıda bunu yayar
    socket.on("siteOnline", (payload: { online: number }) => {
      setOnline(payload?.online ?? null)
    })
    socket.on("connect_error", () => setConnected(false))
  }, [])

  useSocket(NAMESPACES.root, register)

  return (
    <Panel
      title="Socket.IO"
      hint="Kök namespace · handshake.auth.userId ile online sayacı"
    >
      <Row
        label="Bağlantı"
        value={connected ? "açık" : "kapalı"}
        tone={connected ? "good" : "bad"}
      />
      <Row label="Sitede online" value={online ?? "—"} />
      <p className="text-xs leading-relaxed text-muted-foreground">
        Oyun namespace&apos;leri ({Object.keys(NAMESPACES).length - 1} adet) sayfa
        bazında lazy açılır — crash, mines, towers, roll, blackjack, duels,
        battles, unbox, upgrader, cashier, general.
      </p>
    </Panel>
  )
}
