"use client"

import { Dices } from "lucide-react"
import { RailItem, RailShell } from "@/components/casino/rail-shell"
import { CASINO_PROVIDERS, CASINO_PROVIDERS_TOTAL } from "@/lib/casino-page"

/**
 * referans casino arayüzü'daki "Providers" rafı: her kartın ortasında sağlayıcı
 * markası, altında ince ayraçla ayrılmış "Oyunlar N" sayacı bulunur.
 * Sağlayıcı logoları yerine marka adı tipografik olarak gösterilir.
 */
export function ProvidersRail({ onSelect }: { onSelect: (name: string) => void }) {
  return (
    <RailShell title="Sağlayıcılar" icon="blocks" total={CASINO_PROVIDERS_TOTAL} onSeeAll={() => onSelect("")}>
      {CASINO_PROVIDERS.map((provider) => (
        <RailItem key={provider.id}>
          <button
            type="button"
            onClick={() => onSelect(provider.name)}
            className="group flex aspect-[174/196] w-full flex-col overflow-hidden rounded-[14px] bg-card transition-colors hover:bg-secondary"
          >
            <span className="flex flex-1 items-center justify-center px-3">
              <span className="text-balance text-center text-sm font-extrabold uppercase leading-tight tracking-tight text-foreground/85 transition-colors group-hover:text-foreground">
                {provider.name}
              </span>
            </span>

            <span className="flex items-center justify-center gap-1.5 border-t border-border py-2.5 text-xs font-medium text-muted-foreground">
              <Dices className="size-4 text-accent" aria-hidden="true" />
              Oyunlar
              <span className="tabular font-bold text-foreground">{provider.games.toLocaleString("tr-TR")}</span>
            </span>
          </button>
        </RailItem>
      ))}
    </RailShell>
  )
}
