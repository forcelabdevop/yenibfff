"use client"

import { io, type Socket } from "socket.io-client"
import { SOCKET_URL } from "./config"
import { getToken } from "./api"

/**
 * Backend namespace'leri — backend/sockets/index.js
 * Root ("/") bağlantısı yalnızca `siteOnline` yayar.
 */
export const NAMESPACES = {
  root: "/",
  general: "/general",
  cashier: "/cashier",
  crash: "/crash",
  mines: "/mines",
  towers: "/towers",
  roll: "/roll",
  blackjack: "/blackjack",
  duels: "/duels",
  battles: "/battles",
  unbox: "/unbox",
  upgrader: "/upgrader",
} as const

export type Namespace = (typeof NAMESPACES)[keyof typeof NAMESPACES]

const pool = new Map<string, Socket>()

/**
 * Namespace başına tek socket tutar. Oyun sayfaları kendi namespace'ini
 * açar; sayfa değişince release() ile bırakır.
 */
export function getSocket(namespace: Namespace, userId?: string): Socket {
  const token = getToken()
  const key = `${namespace}::${userId ?? "guest"}`
  const existing = pool.get(key)
  if (existing) return existing

  const socket = io(`${SOCKET_URL}${namespace === "/" ? "" : namespace}`, {
    // Namespace middleware'leri handshake.auth.token'ı JWT olarak doğrular
    // (bkz. backend/sockets/crash/index.js). handshake.auth.userId ise
    // /general namespace'inde online sayacı/Notice segmentasyonu için ayrıca
    // okunuyor. Token yoksa (misafir) namespace bağlantıyı yine kabul eder.
    auth: { ...(token ? { token } : {}), ...(userId ? { userId } : {}) },
    withCredentials: true,
    transports: ["websocket", "polling"],
    autoConnect: true,
  })

  pool.set(key, socket)
  return socket
}

export function releaseSocket(namespace: Namespace, userId?: string) {
  const key = `${namespace}::${userId ?? "guest"}`
  const socket = pool.get(key)
  if (socket) {
    socket.removeAllListeners()
    socket.disconnect()
    pool.delete(key)
  }
}

export function releaseAllSockets() {
  for (const socket of pool.values()) {
    socket.removeAllListeners()
    socket.disconnect()
  }
  pool.clear()
}
