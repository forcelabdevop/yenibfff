"use client"

import { Panel, Row, Tag } from "@/components/panel"
import { useSiteSettings } from "@/hooks/use-site-settings"

export function BackendStatus() {
  const { settings, activePaymentProviders, isMaintenance, isLoading, error } =
    useSiteSettings()

  return (
    <Panel
      title="Backend bağlantısı"
      hint="GET /site-settings · doğrudan backend adresi üzerinden"
    >
      {isLoading ? (
        <Row label="Durum" value="bağlanıyor…" tone="warn" />
      ) : error ? (
        <>
          <Row label="Durum" value="ulaşılamıyor" tone="bad" />
          <p className="text-xs leading-relaxed text-muted-foreground">
            Express backend çalışmıyor veya <code className="font-mono">NEXT_PUBLIC_API_BASE_URL</code>{" "}
            yanlış. Backend&apos;i <code className="font-mono">backend/</code> içinde{" "}
            <code className="font-mono">pnpm dev</code> ile ayağa kaldırın.
          </p>
        </>
      ) : (
        <>
          <Row label="Durum" value="bağlı" tone="good" />
          <Row
            label="Bakım modu"
            value={isMaintenance ? "açık" : "kapalı"}
            tone={isMaintenance ? "bad" : "good"}
          />
          <Row
            label="Sportsbook sağlayıcısı"
            value={settings?.sportsbookProvider ?? "—"}
          />
          <div className="flex flex-col gap-2 pt-1">
            <span className="text-xs text-muted-foreground">
              Aktif ödeme sağlayıcıları
            </span>
            <div className="flex flex-wrap gap-1.5">
              {activePaymentProviders.length ? (
                activePaymentProviders.map(({ key, provider }) => (
                  <Tag key={key} tone={provider.currency === "TRY" ? "warn" : "good"}>
                    {provider.name} · {provider.currency}
                  </Tag>
                ))
              ) : (
                <Tag>hiçbiri aktif değil</Tag>
              )}
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Sarı işaretliler TRY tabanlı — EU açılışında EUR sağlayıcılarıyla
              değiştirilecek.
            </p>
          </div>
        </>
      )}
    </Panel>
  )
}
