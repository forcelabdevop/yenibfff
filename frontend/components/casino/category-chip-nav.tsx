"use client"

import { cn } from "@/lib/utils"
import type { CasinoCategory } from "@/lib/casino"

export function CategoryChipNav({
  categories,
  activeSlug,
  onSelect,
}: {
  categories: CasinoCategory[]
  activeSlug: string | null
  onSelect: (slug: string | null) => void
}) {
  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:thin] md:-mx-6 md:px-6">
      <Chip active={activeSlug === null} onClick={() => onSelect(null)}>
        Tümü
      </Chip>
      {categories.map((cat) => (
        <Chip key={cat._id} active={activeSlug === cat.slug} onClick={() => onSelect(cat.slug)}>
          {cat.name}
        </Chip>
      ))}
    </div>
  )
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-semibold whitespace-nowrap transition-colors",
        active
          ? "btn-3d-primary border-transparent text-primary-foreground"
          : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
      )}
    >
      {children}
    </button>
  )
}
