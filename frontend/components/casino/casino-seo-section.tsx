"use client"

import { useState } from "react"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { CASINO_SEO_BLOCKS, CASINO_SEO_INTRO, CASINO_SEO_TITLE } from "@/lib/casino-page"

/**
 * referans casino arayüzü'nun en altındaki uzun SEO metni.
 *
 * Referansta blok varsayılan olarak kırpılır ve altındaki "Daha Fazla Göster"
 * düğmesiyle açılır. Kapalıyken alt kenara doğru zemin rengine karışan bir
 * fade uygulanır. Metin tamamı DOM'da kalır; yalnız yükseklik kısıtlanır, bu
 * sayede arama motorları içeriğin tamamını görür.
 */
export function CasinoSeoSection() {
  const [expanded, setExpanded] = useState(false)

  return (
    <section className="rounded-xl bg-card p-5 md:p-7">
      <div className="relative">
        <div
          className={cn(
            "overflow-hidden transition-[max-height] duration-500",
            expanded ? "max-h-none" : "max-h-[240px]",
          )}
        >
          <h1 className="text-xl font-bold text-foreground md:text-2xl">{CASINO_SEO_TITLE}</h1>

          <p className="mt-3 max-w-[80ch] text-sm leading-relaxed text-muted-foreground">{CASINO_SEO_INTRO}</p>

          {CASINO_SEO_BLOCKS.map((block) => (
            <div key={block.heading} className="mt-6">
              {block.level === 2 ? (
                <h2 className="text-lg font-semibold text-foreground">{block.heading}</h2>
              ) : (
                <h3 className="text-base font-semibold text-foreground">{block.heading}</h3>
              )}

              {block.paragraphs.map((paragraph) => (
                <p key={paragraph} className="mt-2 max-w-[80ch] text-sm leading-relaxed text-muted-foreground">
                  {paragraph}
                </p>
              ))}
            </div>
          ))}
        </div>

        {!expanded ? (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-card to-transparent"
          />
        ) : null}
      </div>

      <div className="mt-4 flex justify-center">
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          className="inline-flex items-center gap-1.5 rounded-lg bg-secondary px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
        >
          {expanded ? "Daha Az Göster" : "Daha Fazla Göster"}
          <ChevronDown className={cn("size-4 transition-transform", expanded && "rotate-180")} aria-hidden="true" />
        </button>
      </div>
    </section>
  )
}
