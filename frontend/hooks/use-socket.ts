"use client"

import { useEffect, useRef } from "react"
import type { Socket } from "socket.io-client"
import { getSocket, releaseSocket, type Namespace } from "@/lib/socket"
import { useAuth } from "@/providers/auth-provider"

/**
 * Bir namespace'e bağlanır ve bileşen sökülünce bırakır.
 * Oyun sayfaları kendi namespace'ini bu hook ile açar.
 */
export function useSocket(
  namespace: Namespace,
  register?: (socket: Socket) => void,
) {
  const { user } = useAuth()
  const userId = user?._id
  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    const socket = getSocket(namespace, userId)
    socketRef.current = socket
    register?.(socket)

    return () => {
      releaseSocket(namespace, userId)
      socketRef.current = null
    }
    // register her render'da yeniden oluşabilir; kasıtlı olarak bağımlılık dışı.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [namespace, userId])

  return socketRef
}
