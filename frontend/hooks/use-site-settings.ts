"use client"

import useSWR from "swr"
import { fetcher } from "@/lib/api"
import type { PaymentProvider, SiteSettings } from "@/lib/types"

/**
 * GET /site-settings — logo, footer, bakım modu ve aktif ödeme
 * sağlayıcıları buradan gelir. Hiçbir sağlayıcı frontend'de hardcode
 * edilmez; admin panelinden açılıp kapanır.
 */
export function useSiteSettings() {
  const { data, error, isLoading } = useSWR<SiteSettings>(
    "/site-settings",
    fetcher,
    { revalidateOnFocus: false },
  )

  const providers: { key: string; provider: PaymentProvider }[] = data
    ? (
        [
          ["forcelabFinance", data.forcelabFinance],
          ["meelDev", data.meelDev],
          ["galaxyPay", data.galaxyPay],
          ["fluxKripto", data.fluxKripto],
          ["xPayments", data.xPayments],
        ] as const
      )
        .filter(([, p]) => p?.isActive)
        .map(([key, provider]) => ({ key, provider }))
    : []

  return {
    settings: data,
    activePaymentProviders: providers,
    isMaintenance: data?.maintenanceMode ?? false,
    isLoading,
    error,
  }
}
