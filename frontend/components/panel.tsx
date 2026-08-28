import { cn } from "@/lib/utils"

export function Panel({
  title,
  hint,
  children,
  className,
}: {
  title: string
  hint?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <section
      className={cn(
        "flex flex-col gap-4 rounded-[var(--radius)] border border-border bg-card p-5",
        className,
      )}
    >
      <header className="flex flex-col gap-1">
        <h2 className="text-sm font-semibold tracking-tight text-card-foreground">
          {title}
        </h2>
        {hint ? (
          <p className="text-xs leading-relaxed text-muted-foreground">{hint}</p>
        ) : null}
      </header>
      {children}
    </section>
  )
}

export function Row({
  label,
  value,
  tone = "default",
}: {
  label: string
  value: React.ReactNode
  tone?: "default" | "good" | "warn" | "bad"
}) {
  const toneClass = {
    default: "text-foreground",
    good: "text-accent",
    warn: "text-primary",
    bad: "text-destructive",
  }[tone]

  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border/60 pb-2 last:border-0 last:pb-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={cn("tabular font-mono text-xs", toneClass)}>{value}</span>
    </div>
  )
}

export function Tag({
  children,
  tone = "muted",
}: {
  children: React.ReactNode
  tone?: "muted" | "good" | "warn"
}) {
  const toneClass = {
    muted: "border-border bg-muted text-muted-foreground",
    good: "border-accent/40 bg-accent/10 text-accent",
    warn: "border-primary/40 bg-primary/10 text-primary",
  }[tone]

  return (
    <span
      className={cn(
        "rounded-full border px-2 py-0.5 font-mono text-[11px] leading-5",
        toneClass,
      )}
    >
      {children}
    </span>
  )
}
