"use client"

import { useMemo, useState } from "react"
import { Gamepad2, Loader2 } from "lucide-react"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { GameCard } from "@/components/casino/game-card"
import { GameCardShell } from "@/components/casino/game-card-shell"
import { GameLaunchDialog } from "@/components/casino/game-launch-dialog"
import { RailItem, RailShell } from "@/components/casino/rail-shell"
import { CasinoPromoCarousel } from "@/components/casino/casino-promo-carousel"
import { CasinoTabs } from "@/components/casino/casino-tabs"
import { GetBonusBanner } from "@/components/casino/get-bonus-banner"
import { TopWinsRail } from "@/components/casino/top-wins-rail"
import { ProvidersRail } from "@/components/casino/providers-rail"
import { BattlesSection } from "@/components/casino/battles-section"
import { GamePickerBanner } from "@/components/casino/game-picker-banner"
import { CasinoBetsTable } from "@/components/casino/casino-bets-table"
import { CasinoSeoSection } from "@/components/casino/casino-seo-section"
import { AuthDialog } from "@/components/auth/auth-dialog"
import { useAuth } from "@/providers/auth-provider"
import { useCategoriesWithGames, useGamesByCategory, useGameSearch } from "@/hooks/use-casino"
import { CASINO_PAGE_SIZE, type CasinoGame, type CategoryWithGames } from "@/lib/casino"
import {
  CASINO_RAILS_BOTTOM,
  CASINO_RAILS_TOP,
  type CasinoRailDef,
  type CasinoTabId,
  type FallbackGame,
} from "@/lib/casino-page"

/** Hangi rafın hangi sekmede görüneceği. Lobi sekmesi hepsini gösterir. */
const RAIL_TABS: Record<string, CasinoTabId[]> = {
  slots: ["slots"],
  originals: ["originals"],
  hot: ["slots"],
  live: ["live"],
  highroller: ["live"],
  gameshows: ["live"],
  exclusives: ["originals"],
  roulette: ["table"],
  blackjack: ["table"],
  new: ["slots"],
}

/**
 * referans casino arayüzü sayfasının birebir klonu.
 *
 * Bölüm sırası referanstan alınmıştır: promo carousel → sekmeler → Slotlar,
 * Originals, Öne Çıkanlar rafları → Get Bonus bannerı → Son Büyük Kazançlar →
 * Sağlayıcılar → Savaşlar & Turnuvalar → Canlı, Highroller, Oyun Şovları,
 * Özel, Rulet, Blackjack, Yeni Çıkanlar rafları → oyun seçme bannerı →
 * bahis tablosu → SEO metni.
 *
 * Raflar backend'den gelen kategorilerle eşleşirse gerçek oyunlarla, aksi
 * halde referans ölçülerini koruyan deterministik yedek kartlarla dolar;
 * böylece hiçbir noktada boş alan oluşmaz.
 */
export function CasinoBrowser() {
  const { isAuthenticated } = useAuth()
  const [tab, setTab] = useState<CasinoTabId>("lobby")
  const [query, setQuery] = useState("")
  const [activeSlug, setActiveSlug] = useState<string | null>(null)
  const [page, setPage] = useState(0)
  const [selectedGame, setSelectedGame] = useState<CasinoGame | null>(null)
  const [authOpen, setAuthOpen] = useState(false)

  const { categories, isLoading: categoriesLoading } = useCategoriesWithGames()

  const {
    games: categoryGames,
    total: categoryTotal,
    isLoading: categoryLoading,
  } = useGamesByCategory(activeSlug, page)

  const isSearching = query.trim().length >= 2
  const { results: searchResults, isLoading: searchLoading } = useGameSearch(query)

  const activeCategory = categories.find((category) => category.slug === activeSlug) ?? null

  /** Raf tanımlarını backend kategorileriyle eşleştirir. */
  const matchRail = useMemo(() => {
    return (rail: CasinoRailDef): CategoryWithGames | null => {
      for (const keyword of rail.match) {
        const found = categories.find(
          (category) =>
            category.games.length > 0 &&
            (category.slug.toLowerCase().includes(keyword) || category.name.toLowerCase().includes(keyword)),
        )
        if (found) return found
      }
      return null
    }
  }, [categories])

  function requireAuth(action: () => void) {
    if (!isAuthenticated) {
      setAuthOpen(true)
      return
    }
    action()
  }

  function handlePlay(game: CasinoGame) {
    requireAuth(() => setSelectedGame(game))
  }

  function openCategory(slug: string) {
    setActiveSlug(slug)
    setPage(0)
    setQuery("")
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" })
  }

  function handleTabChange(next: CasinoTabId) {
    setTab(next)
    setActiveSlug(null)
    setPage(0)
    setQuery("")
  }

  const visibleTop = CASINO_RAILS_TOP.filter((rail) => tab === "lobby" || RAIL_TABS[rail.id]?.includes(tab))
  const visibleBottom = CASINO_RAILS_BOTTOM.filter((rail) => tab === "lobby" || RAIL_TABS[rail.id]?.includes(tab))
  const hasMore = activeSlug ? (page + 1) * CASINO_PAGE_SIZE < categoryTotal : false

  /* Arama veya tek kategori görünümü: raflar yerine tam ızgara gösterilir. */
  if (isSearching || activeSlug) {
    return (
      <div className="flex flex-col gap-6">
        <CasinoTabs active={tab} onSelect={handleTabChange} query={query} onQueryChange={setQuery} />

        <FullGrid
          title={isSearching ? `"${query.trim()}" için sonuçlar` : (activeCategory?.name ?? "Kategori")}
          games={isSearching ? searchResults : categoryGames}
          loading={isSearching ? searchLoading : categoryLoading}
          hasMore={!isSearching && hasMore}
          onLoadMore={() => setPage((value) => value + 1)}
          onPlay={handlePlay}
          onBack={() => {
            setActiveSlug(null)
            setQuery("")
          }}
        />

        <GameLaunchDialog game={selectedGame} onClose={() => setSelectedGame(null)} />
        <AuthDialog open={authOpen} onOpenChange={setAuthOpen} initialMode="login" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-7 md:gap-8">
      <CasinoPromoCarousel />

      <CasinoTabs active={tab} onSelect={handleTabChange} query={query} onQueryChange={setQuery} />

      {categoriesLoading ? (
        <RailSkeletons count={3} />
      ) : (
        visibleTop.map((rail) => (
          <Rail key={rail.id} rail={rail} category={matchRail(rail)} onPlay={handlePlay} onSeeAll={openCategory} />
        ))
      )}

      <GetBonusBanner onSignUp={() => requireAuth(() => undefined)} />

      <TopWinsRail />

      <ProvidersRail onSelect={() => requireAuth(() => undefined)} />

      <BattlesSection onParticipate={() => requireAuth(() => undefined)} />

      {categoriesLoading
        ? <RailSkeletons count={4} />
        : visibleBottom.map((rail) => (
            <Rail key={rail.id} rail={rail} category={matchRail(rail)} onPlay={handlePlay} onSeeAll={openCategory} />
          ))}

      <GamePickerBanner onSpin={() => requireAuth(() => undefined)} />

      <CasinoBetsTable />

      <CasinoSeoSection />

      <GameLaunchDialog game={selectedGame} onClose={() => setSelectedGame(null)} />
      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} initialMode="login" />
    </div>
  )
}

/**
 * Tek bir raf. Backend kategorisi eşleştiyse gerçek oyunları, aksi halde
 * yedek kartları render eder.
 */
function Rail({
  rail,
  category,
  onPlay,
  onSeeAll,
}: {
  rail: CasinoRailDef
  category: CategoryWithGames | null
  onPlay: (game: CasinoGame) => void
  onSeeAll: (slug: string) => void
}) {
  const useLive = !!category && category.games.length > 0

  return (
    <RailShell
      title={useLive ? category.name : rail.title}
      icon={rail.icon}
      badge={rail.badge}
      total={useLive ? category.total_games : rail.total}
      onSeeAll={useLive ? () => onSeeAll(category.slug) : undefined}
    >
      {useLive
        ? category.games.slice(0, 14).map((game) => (
            <RailItem key={game._id}>
              <GameCard game={game} onPlay={onPlay} />
            </RailItem>
          ))
        : rail.games.map((game) => (
            <RailItem key={game.id}>
              <FallbackCard game={game} onPlay={onPlay} />
            </RailItem>
          ))}
    </RailShell>
  )
}

/** Yedek kart — gerçek oyun kartıyla aynı ölçü ve hover davranışına sahiptir. */
function FallbackCard({ game, onPlay }: { game: FallbackGame; onPlay: (game: CasinoGame) => void }) {
  const asCasinoGame: CasinoGame = {
    _id: game.id,
    game_name: game.name,
    game_code: game.id,
    banner: game.image,
    provider: { _id: game.provider, name: game.provider },
  }

  return (
    <GameCardShell
      image={game.image}
      name={game.name}
      provider={game.provider}
      badge={game.badge}
      rtp={game.rtp}
      onPlay={() => onPlay(asCasinoGame)}
      onDemo={() => onPlay(asCasinoGame)}
      sizes="(min-width: 1024px) 16vw, (min-width: 640px) 25vw, 42vw"
    />
  )
}

function FullGrid({
  title,
  games,
  loading,
  hasMore,
  onLoadMore,
  onPlay,
  onBack,
}: {
  title: string
  games: CasinoGame[]
  loading: boolean
  hasMore: boolean
  onLoadMore: () => void
  onPlay: (game: CasinoGame) => void
  onBack: () => void
}) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="truncate text-lg font-semibold text-foreground">{title}</h2>
        <button
          type="button"
          onClick={onBack}
          className="shrink-0 text-sm font-semibold text-accent transition-opacity hover:opacity-80"
        >
          Lobiye dön
        </button>
      </div>

      {loading && games.length === 0 ? (
        <GridSkeleton />
      ) : games.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Gamepad2 className="size-6" aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle>Oyun bulunamadı</EmptyTitle>
            <EmptyDescription>Farklı bir arama terimi veya kategori dene.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3 md:grid-cols-5 md:gap-4 lg:grid-cols-6">
            {games.map((game) => (
              <GameCard key={game._id} game={game} onPlay={onPlay} />
            ))}
          </div>

          {hasMore ? (
            <div className="flex justify-center pt-2">
              <Button variant="outline" onClick={onLoadMore} disabled={loading}>
                {loading ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
                Daha fazla yükle
              </Button>
            </div>
          ) : null}
        </>
      )}
    </section>
  )
}

function RailSkeletons({ count }: { count: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-6 w-24" />
          </div>
          <div className="flex gap-2 sm:gap-3 md:gap-4">
            {Array.from({ length: 6 }).map((_, cardIndex) => (
              <Skeleton
                key={cardIndex}
                className="aspect-[174/230] w-[calc((100%-16px)/3)] shrink-0 rounded-[14px] sm:w-[calc((100%-36px)/4)] md:w-[calc((100%-64px)/5)] lg:w-[calc((100%-80px)/6)]"
              />
            ))}
          </div>
        </div>
      ))}
    </>
  )
}

function GridSkeleton() {
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3 md:grid-cols-5 md:gap-4 lg:grid-cols-6">
      {Array.from({ length: 18 }).map((_, index) => (
        <Skeleton key={index} className="aspect-[174/230] rounded-[14px]" />
      ))}
    </div>
  )
}
