"use client"

import { createContext, useContext, useMemo } from "react"
import { DEFAULT_FIAT } from "@/lib/config"
import { formatFiat } from "@/lib/currency"
import type { FiatCode, WalletEntry } from "@/lib/types"
import { useAuth } from "./auth-provider"

/**
 * Backend'de şu an tek dahili cüzdan var (Rivo, bkz. backend/utils/rivoWallet.js).
 * Çok kripto / çok fiat cüzdan değiştirme altyapısı (POST /wallet/convert-to-fiat)
 * henüz canlı değil (User.balance.data şemasını referans alıyor, gerçek şema
 * User.wallets[] — o route her zaman hata döner). Bu yüzden burada sadece
 * aktif cüzdanın bakiyesini ve kullanıcının kayıt olurken seçtiği görüntüleme
 * para birimini gösteriyoruz.
 */
interface WalletContextValue {
  fiat: FiatCode
  balance: number
  formattedBalance: string
  wallet: WalletEntry | null
  hasWallet: boolean
}

const WalletContext = createContext<WalletContextValue | null>(null)

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()

  const value = useMemo<WalletContextValue>(() => {
    const fiat = (user?.currency?.fiatCurrency as FiatCode) ?? (DEFAULT_FIAT as FiatCode)
    const wallets = user?.wallets ?? []
    const activeWallet =
      wallets.find(
        (w) =>
          w.coinType === user?.currency?.coinType &&
          w.chain === user?.currency?.chain &&
          w.type === user?.currency?.type,
      ) ?? wallets[0] ?? null

    const balance = activeWallet?.balance ?? 0

    return {
      fiat,
      balance,
      formattedBalance: formatFiat(balance, fiat),
      wallet: activeWallet,
      hasWallet: wallets.length > 0,
    }
  }, [user])

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
}

export function useWallet() {
  const ctx = useContext(WalletContext)
  if (!ctx) throw new Error("useWallet must be used inside WalletProvider")
  return ctx
}
