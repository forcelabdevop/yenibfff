"use client"

import { TooltipProvider } from "@/components/ui/tooltip"
import { Toaster } from "@/components/ui/sonner"
import { AuthProvider } from "./auth-provider"
import { LocaleProvider } from "./locale-provider"
import { WalletProvider } from "./wallet-provider"

/**
 * Sıra önemli: WalletProvider, useAuth'a bağımlı.
 */
export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <LocaleProvider>
      <AuthProvider>
        <WalletProvider>
          <TooltipProvider delayDuration={200}>
            {children}
            <Toaster theme="dark" position="top-right" />
          </TooltipProvider>
        </WalletProvider>
      </AuthProvider>
    </LocaleProvider>
  )
}
