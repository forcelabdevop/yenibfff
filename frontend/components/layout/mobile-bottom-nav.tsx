"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronRight, Menu, MessageSquare, Spade, Trophy, Volleyball } from "lucide-react"
import { cn } from "@/lib/utils"

export function MobileBottomNav({ onMenuToggle }: { onMenuToggle: () => void; onAuthOpen: (mode: "login" | "register") => void }) {
  const pathname = usePathname()
  const [contestsOpen, setContestsOpen] = useState(false)

  return (
    <>
      {contestsOpen ? (
        <div className="fixed inset-x-0 bottom-[67px] z-30 rounded-t-2xl border border-border bg-card px-5 py-5 shadow-2xl md:hidden">
          <button
            type="button"
            onClick={() => setContestsOpen(false)}
            className="flex w-full items-center gap-3 rounded-lg px-1 py-3 text-left text-sm font-semibold text-foreground"
          >
            <Trophy className="size-5 text-accent" aria-hidden="true" />
            <span className="flex-1">Savaşlar &amp; Turnuvalar</span>
            <span className="rounded-md bg-muted px-2 py-1 text-xs font-bold text-accent">7</span>
            <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />
          </button>
          <Link
            href="/contests"
            onClick={() => setContestsOpen(false)}
            className="flex items-center gap-3 rounded-lg px-1 py-3 text-sm font-semibold text-foreground"
          >
            <Trophy className="size-5 text-muted-foreground" aria-hidden="true" />
            Liderlik Tablosu
          </Link>
        </div>
      ) : null}

      <nav className="fixed inset-x-0 bottom-0 z-40 flex h-[68px] items-stretch rounded-t-2xl border border-border bg-card shadow-2xl md:hidden" aria-label="Alt gezinme">
        <NavButton label="Menü" onClick={onMenuToggle} icon={<Menu className="size-5" aria-hidden="true" />} />

        <NavButton
          label="Turnuvalar"
          active={contestsOpen || pathname === "/contests"}
          onClick={() => setContestsOpen((open) => !open)}
          icon={<Trophy className="size-5 fill-current" aria-hidden="true" />}
        />

        <Link
          href="/casino"
          className={cn("relative flex flex-1 flex-col items-center justify-end gap-0.5 pb-2", pathname === "/casino" ? "text-foreground" : "text-muted-foreground")}
        >
          {pathname === "/casino" ? <ActiveGlow /> : null}
          <span className={cn("absolute -top-5 z-10 flex size-12 items-center justify-center rounded-full border-4 border-card bg-muted shadow-lg", pathname === "/casino" && "bg-primary text-primary-foreground shadow-[0_5px_22px_color-mix(in_oklab,var(--primary)_60%,transparent)]")}>
            <Spade className="size-5 fill-current" aria-hidden="true" />
          </span>
          <span className="relative z-10 text-xs font-semibold">Casino</span>
        </Link>

        <NavLink href="/sports" label="Spor" active={pathname === "/sports"} icon={<Volleyball className="size-5" aria-hidden="true" />} />
        <NavLink href="/chat" label="Sohbet" active={pathname === "/chat"} icon={<MessageSquare className="size-5" aria-hidden="true" />} />
      </nav>
    </>
  )
}

function NavButton({ label, icon, active = false, onClick }: { label: string; icon: React.ReactNode; active?: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={cn("relative flex flex-1 flex-col items-center justify-center gap-1", active ? "text-foreground" : "text-muted-foreground")}>
      {active ? <ActiveGlow /> : null}
      <span className="relative z-10">{icon}</span>
      <span className="relative z-10 text-xs font-medium">{label}</span>
    </button>
  )
}

function NavLink({ href, label, icon, active }: { href: string; label: string; icon: React.ReactNode; active: boolean }) {
  return (
    <Link href={href} className={cn("relative flex flex-1 flex-col items-center justify-center gap-1", active ? "text-foreground" : "text-muted-foreground")}>
      {active ? <ActiveGlow /> : null}
      <span className="relative z-10">{icon}</span>
      <span className="relative z-10 text-xs font-medium">{label}</span>
    </Link>
  )
}

function ActiveGlow() {
  return (
    <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 z-0 mx-auto h-11 w-20 overflow-visible">
      <span className="absolute -bottom-2 left-1/2 h-10 w-16 -translate-x-1/2 rounded-full bg-primary/45 blur-xl" />
      <span className="absolute inset-x-3 bottom-0 h-[3px] rounded-t-full bg-primary shadow-[0_-6px_16px_4px_color-mix(in_oklab,var(--primary)_70%,transparent)]" />
    </span>
  )
}
