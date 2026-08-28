"use client"

import { useState } from "react"
import { ChevronDown } from "lucide-react"
import { SEO_SECTIONS } from "@/lib/mock-lobby"
import { cn } from "@/lib/utils"

/**
 * referans casino arayüzü'in ana sayfa altındaki uzun SEO metin bloğunun birebir kopyası:
 * bir dizi başlık + paragraf, varsayılan olarak kısaltılmış ve
 * "Daha fazla göster" ile açılan bir görünüm.
 */
export function SeoContentBlock() {
  const [expanded, setExpanded] = useState(false)

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5">
      <div
        className={cn(
          "relative flex flex-col gap-6 overflow-hidden",
          !expanded && "max-h-72",
        )}
      >
        {SEO_SECTIONS.map((section) => (
          <div key={section.id} className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold text-foreground">{section.heading}</h3>
            {section.body.map((paragraph, i) => (
              <p key={i} className="text-sm leading-relaxed text-muted-foreground">
                {paragraph}
              </p>
            ))}
          </div>
        ))}

        {!expanded && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-card to-transparent" />
        )}
      </div>

      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="mx-auto flex items-center gap-1.5 text-sm font-semibold text-primary transition-colors hover:text-primary/80"
      >
        {expanded ? "Daha az göster" : "Daha fazla göster"}
        <ChevronDown
          className={cn("size-4 transition-transform", expanded && "rotate-180")}
          aria-hidden="true"
        />
      </button>
    </section>
  )
}
