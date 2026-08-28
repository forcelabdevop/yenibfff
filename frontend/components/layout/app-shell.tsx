"use client"

import { useState } from "react"
import { SiteHeader } from "@/components/layout/site-header"
import { SiteSidebar } from "@/components/layout/site-sidebar"
import { SiteFooter } from "@/components/layout/site-footer"
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav"
import { AuthDialog } from "@/components/auth/auth-dialog"

export function AppShell({ children }: { children: React.ReactNode }) {
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(true)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [authOpen, setAuthOpen] = useState(false)
  const [authMode, setAuthMode] = useState<"login" | "register">("login")

  function openAuth(mode: "login" | "register") {
    setAuthMode(mode)
    setAuthOpen(true)
  }

  function toggleSidebar() {
    if (window.matchMedia("(min-width: 768px)").matches) {
      setDesktopSidebarOpen((open) => !open)
    } else {
      setMobileSidebarOpen((open) => !open)
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader onMenuToggle={toggleSidebar} onAuthOpen={openAuth} />
      <div className="flex min-w-0 flex-1">
        <SiteSidebar
          desktopOpen={desktopSidebarOpen}
          mobileOpen={mobileSidebarOpen}
          onMobileClose={() => setMobileSidebarOpen(false)}
        />
        <div className="flex min-w-0 flex-1 flex-col pb-[72px] md:pb-0">
          <div className="min-w-0 flex-1">{children}</div>
          <SiteFooter />
        </div>
      </div>
      <MobileBottomNav onMenuToggle={toggleSidebar} onAuthOpen={openAuth} />
      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} initialMode={authMode} />
    </div>
  )
}
