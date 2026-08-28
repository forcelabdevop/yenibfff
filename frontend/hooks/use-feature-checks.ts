"use client"

import { useEffect, useRef, useState } from "react"
import { io, type Socket } from "socket.io-client"
import { SOCKET_URL } from "@/lib/config"
import { FEATURES, checkRestFeature, type CheckResult } from "@/lib/diagnostics"

export type LiveStatus = "checking" | "ok" | "fail"

export interface FeatureState {
  status: LiveStatus
  detail: string
}

/**
 * Bir socket namespace'ine bağlanır, "connect" gelirse ok sayar.
 * socket-event tipinde ise ayrıca belirtilen event dinlenir (ama event
 * gelmemesi hata değildir — event ancak tetikleyen bir aksiyon olunca gelir,
 * bu yüzden connect başarısı yeterli kabul edilir).
 */
function probeNamespace(namespace: string, authRequired?: boolean): Promise<FeatureState> {
  return new Promise((resolve) => {
    const socket: Socket = io(`${SOCKET_URL}/${namespace}`, {
      transports: ["polling", "websocket"],
      autoConnect: true,
      reconnection: false,
      timeout: 6000,
    })

    const finish = (state: FeatureState) => {
      socket.removeAllListeners()
      socket.disconnect()
      resolve(state)
    }

    const timer = setTimeout(() => {
      finish({ status: "fail", detail: "zaman aşımı (6s)" })
    }, 6500)

    socket.on("connect", () => {
      clearTimeout(timer)
      finish({ status: "ok", detail: "bağlandı" })
    })

    socket.on("connect_error", (err) => {
      clearTimeout(timer)
      // Bu namespace token zorunlu kılıyorsa (örn. mines/towers middleware'i),
      // "sign in" reddi backend'in canlı ve doğru çalıştığını gösterir.
      const isAuthRejection = /sign in/i.test(err.message || "")
      if (authRequired && isAuthRejection) {
        finish({ status: "ok", detail: "korumalı (beklenen) · " + err.message })
        return
      }
      finish({ status: "fail", detail: err.message || "bağlantı hatası" })
    })
  })
}

/**
 * Tüm FEATURES listesini tarar: rest -> fetch, socket-namespace/socket-event
 * -> probeNamespace. Namespace başına tek deneme yeterli (aynı namespace'i
 * birden fazla event testi paylaşıyorsa cache'lenir).
 */
export function useFeatureChecks() {
  const [results, setResults] = useState<Record<string, FeatureState>>({})
  const [runId, setRunId] = useState(0)
  const namespaceCache = useRef<Map<string, Promise<FeatureState>>>(new Map())

  useEffect(() => {
    namespaceCache.current.clear()
    let cancelled = false

    setResults((prev) => {
      const next: Record<string, FeatureState> = {}
      for (const f of FEATURES) next[f.id] = { status: "checking", detail: "" }
      return next
    })

    FEATURES.forEach(async (spec) => {
      if (spec.kind === "rest") {
        const res: CheckResult = await checkRestFeature(spec)
        if (cancelled) return
        setResults((prev) => ({
          ...prev,
          [spec.id]: {
            status: res.ok ? "ok" : "fail",
            detail: `${res.detail} · ${res.latencyMs}ms${res.status ? ` · ${res.status}` : ""}`,
          },
        }))
        return
      }

      // socket-namespace / socket-event: aynı target birden fazla feature
      // tarafından paylaşılıyorsa (örn. general), tek bağlantıyı paylaş.
      let probe = namespaceCache.current.get(spec.target)
      if (!probe) {
        probe = probeNamespace(spec.target, spec.authRequired)
        namespaceCache.current.set(spec.target, probe)
      }
      const state = await probe
      if (cancelled) return
      setResults((prev) => ({ ...prev, [spec.id]: state }))
    })

    return () => {
      cancelled = true
    }
  }, [runId])

  const rerun = () => setRunId((n) => n + 1)

  return { results, rerun }
}
