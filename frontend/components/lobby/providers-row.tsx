import Link from "next/link"
import { Blocks } from "lucide-react"
import { MOCK_PROVIDERS } from "@/lib/mock-lobby"

/**
 * referans casino arayüzü'in "Providers" bölümünün birebir kopyası: yatay kaydırılan
 * sağlayıcı çipleri şeridi. Görsel doku amaçlıdır, gerçek sağlayıcı
 * entegrasyonunu temsil etmez.
 */
export function ProvidersRow() {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Blocks className="size-4 text-primary" aria-hidden="true" />
        <h2 className="text-base font-semibold text-foreground">Sağlayıcılar</h2>
      </div>

      <div className="scrollbar-hidden -mx-4 flex gap-2.5 overflow-x-auto px-4 pb-1 md:-mx-6 md:px-6">
        {MOCK_PROVIDERS.map((provider) => (
          <Link
            key={provider.id}
            href="/casino"
            className="flex h-20 w-36 shrink-0 items-center justify-center rounded-md border border-border bg-card px-3 text-center text-xs font-bold uppercase tracking-wide text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
          >
            {provider.name}
          </Link>
        ))}
      </div>
    </section>
  )
}
