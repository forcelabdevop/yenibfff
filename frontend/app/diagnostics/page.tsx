import { BackendStatus } from "@/components/foundation/backend-status"
import { SocketStatus } from "@/components/foundation/socket-status"
import { FeatureMatrix } from "@/components/diagnostics/feature-matrix"
import { Panel, Row } from "@/components/panel"
import { WEBSITE_NAME } from "@/lib/config"

/**
 * İç geliştirme diagnostiği. Gerçek ana sayfa artık app/page.tsx'te.
 * FeatureMatrix, backend/routes ve backend/sockets içindeki TÜM özellikleri
 * (oyunlar, chat, rain, vault, ödeme sağlayıcıları vb.) canlı olarak test eder.
 */
export default function DiagnosticsPage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-5 py-12 md:px-8">
      <header className="flex flex-col gap-3 border-b border-border pb-8">
        <span className="font-mono text-xs uppercase tracking-[0.2em] text-primary">
          {WEBSITE_NAME} · Diagnostik
        </span>
        <h1 className="max-w-2xl text-pretty text-3xl font-semibold leading-tight tracking-tight md:text-4xl">
          Sistem özellikleri diagnostiği
        </h1>
        <p className="max-w-2xl text-pretty text-sm leading-relaxed text-muted-foreground">
          Next.js 16 + TypeScript + Tailwind v4. Express backend&apos;e API
          client, Socket.IO yöneticisi ve i18n katmanı üzerinden bağlı.
          Aşağıdaki matris backend&apos;deki tüm oyun, sosyal (chat/rain/vault)
          ve ödeme özelliklerini canlı test eder.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <BackendStatus />
        <SocketStatus />

        <Panel
          title="Kurulan katmanlar"
          hint="Tasarım katmanı hariç her şey hazır"
        >
          <Row label="lib/api.ts" value="JWT + direct API + ApiError" tone="good" />
          <Row label="lib/socket.ts" value="namespace havuzu" tone="good" />
          <Row label="lib/i18n" value="EN · DE · ES · FR" tone="good" />
          <Row label="providers/" value="locale · auth · wallet" tone="good" />
          <Row label="docs/API-CONTRACT.md" value="tam backend haritası" tone="good" />
          <Row label="Crash oyunu" value="canlı socket bağlantısı" tone="good" />
          <Row label="EU uyum (KYC, limitler)" value="bekliyor" tone="warn" />
        </Panel>
      </div>

      <FeatureMatrix />

      <footer className="border-t border-border pt-6">
        <p className="text-xs leading-relaxed text-muted-foreground">
          18+ · Gambling can be addictive. Play responsibly.
        </p>
      </footer>
    </main>
  )
}
