"use client"

import { Panel } from "@/components/panel"
import { FEATURE_GROUPS, FEATURES } from "@/lib/diagnostics"
import { useFeatureChecks } from "@/hooks/use-feature-checks"
import { cn } from "@/lib/utils"

const KIND_LABEL = {
  rest: "REST",
  "socket-namespace": "Socket · ns",
  "socket-event": "Socket · event",
} as const

function StatusDot({ status }: { status: "checking" | "ok" | "fail" }) {
  return (
    <span
      className={cn(
        "inline-block size-2 rounded-full",
        status === "checking" && "animate-pulse bg-muted-foreground/40",
        status === "ok" && "bg-accent",
        status === "fail" && "bg-destructive",
      )}
      aria-hidden
    />
  )
}

export function FeatureMatrix() {
  const { results, rerun } = useFeatureChecks()

  const okCount = Object.values(results).filter((r) => r.status === "ok").length
  const failCount = Object.values(results).filter((r) => r.status === "fail").length
  const total = FEATURES.length

  return (
    <Panel
      title="Sistem özellikleri"
      hint={`backend/routes ve backend/sockets taranarak çıkarıldı · ${total} özellik`}
    >
      <div className="flex items-center justify-between gap-4 border-b border-border/60 pb-3">
        <div className="flex items-center gap-3 font-mono text-xs">
          <span className="flex items-center gap-1.5 text-accent">
            <StatusDot status="ok" /> {okCount} çalışıyor
          </span>
          <span className="flex items-center gap-1.5 text-destructive">
            <StatusDot status="fail" /> {failCount} hata
          </span>
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <StatusDot status="checking" /> {total - okCount - failCount} test ediliyor
          </span>
        </div>
        <button
          type="button"
          onClick={rerun}
          className="rounded-full border border-border px-3 py-1 font-mono text-[11px] text-muted-foreground transition-colors hover:border-accent/50 hover:text-accent"
        >
          yeniden test et
        </button>
      </div>

      <div className="flex flex-col gap-5">
        {FEATURE_GROUPS.map((group) => {
          const items = FEATURES.filter((f) => f.group === group)
          if (!items.length) return null
          return (
            <div key={group} className="flex flex-col gap-2">
              <h3 className="text-xs font-semibold tracking-tight text-card-foreground">
                {group}
              </h3>
              <div className="flex flex-col gap-1.5">
                {items.map((f) => {
                  const state = results[f.id] ?? { status: "checking" as const, detail: "" }
                  return (
                    <div
                      key={f.id}
                      className="flex items-center justify-between gap-3 rounded-md border border-border/60 bg-muted/30 px-3 py-2"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <StatusDot status={state.status} />
                        <span className="truncate text-xs text-foreground">{f.label}</span>
                        <span className="hidden shrink-0 rounded-full border border-border bg-card px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:inline-block">
                          {KIND_LABEL[f.kind]}
                        </span>
                      </div>
                      <span
                        className={cn(
                          "shrink-0 truncate font-mono text-[11px]",
                          state.status === "ok" && "text-accent",
                          state.status === "fail" && "text-destructive",
                          state.status === "checking" && "text-muted-foreground",
                        )}
                      >
                        {state.detail || "…"}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </Panel>
  )
}
