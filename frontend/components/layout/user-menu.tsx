"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import { ChevronDown, LogOut, User as UserIcon } from "lucide-react"
import { useAuth } from "@/providers/auth-provider"
import { backendUrl } from "@/lib/config"

export function UserMenu() {
  const { user, logout } = useAuth()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onClick)
    return () => document.removeEventListener("mousedown", onClick)
  }, [open])

  if (!user) return null

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-full border border-border bg-muted px-2 py-1.5 transition-colors hover:bg-muted/70"
      >
        {user.avatar ? (
          <Image
            src={backendUrl(user.avatar)}
            alt=""
            width={24}
            height={24}
            className="size-6 rounded-full object-cover"
          />
        ) : (
          <span className="flex size-6 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <UserIcon className="size-3.5" aria-hidden="true" />
          </span>
        )}
        <span className="max-w-[8rem] truncate text-sm font-medium text-foreground">
          {user.username}
        </span>
        <ChevronDown className="size-3.5 text-muted-foreground" aria-hidden="true" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+0.5rem)] w-48 rounded-md border border-border bg-popover p-1 shadow-xl"
        >
          <div className="border-b border-border px-3 py-2">
            <p className="truncate text-sm font-medium text-foreground">{user.username}</p>
            {user.email && (
              <p className="truncate text-xs text-muted-foreground">{user.email}</p>
            )}
          </div>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false)
              logout()
            }}
            className="mt-1 flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-sm text-destructive transition-colors hover:bg-destructive/10"
          >
            <LogOut className="size-4" aria-hidden="true" />
            Çıkış yap
          </button>
        </div>
      )}
    </div>
  )
}
