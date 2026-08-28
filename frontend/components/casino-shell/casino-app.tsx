"use client"

import Image from "next/image"
import Link from "next/link"
import { useMemo, useState } from "react"
import {
  ChevronDown, ChevronLeft, ChevronRight, CircleDollarSign, Dices, Flame,
  Gamepad2, Gift, Heart, Home, Languages, Loader2, LogOut, Menu, MessageCircle,
  Search, ShieldCheck, Spade, Star, Trophy, UserRound, WalletCards, X,
} from "lucide-react"
import { AuthDialog } from "@/components/auth/auth-dialog"
import { GameLaunchDialog } from "@/components/casino/game-launch-dialog"
import { useCategoriesWithGames, useGameSearch } from "@/hooks/use-casino"
import type { CasinoGame, CategoryWithGames } from "@/lib/casino"
import { useAuth } from "@/providers/auth-provider"
import { useWallet } from "@/providers/wallet-provider"
import { backendUrl, WEBSITE_NAME } from "@/lib/config"
import "./casino-shell.css"

const fallbackArt = [8, 9, 12, 13, 14, 10, 11, 15, 16, 18, 19]
const navItems = [
  ["Casino", Spade], [`${WEBSITE_NAME} Originals`, Dices], ["Sports", Trophy],
  ["Bonuses", Gift], ["Crypto Staking", CircleDollarSign], ["VIP Club", Star],
] as const

function gameImage(game: CasinoGame, index: number) {
  const image = game.banner || game.background
  return image ? backendUrl(image) : `/casino-ui/assets/image-${fallbackArt[index % fallbackArt.length]}.png`
}

export function CasinoApp() {
  const { user, isAuthenticated, isLoading: authLoading, logout } = useAuth()
  const { formattedBalance } = useWallet()
  const { categories, isLoading, error } = useCategoriesWithGames()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [authMode, setAuthMode] = useState<"login" | "register">("login")
  const [authOpen, setAuthOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [selectedGame, setSelectedGame] = useState<CasinoGame | null>(null)
  const [profileOpen, setProfileOpen] = useState(false)
  const { results, isLoading: searchLoading } = useGameSearch(query)

  const rails = useMemo(() => categories.filter((category) => category.games.length).slice(0, 5), [categories])
  const featured = rails.flatMap((rail) => rail.games).slice(0, 6)

  function openAuth(mode: "login" | "register") {
    setAuthMode(mode)
    setAuthOpen(true)
  }

  function play(game: CasinoGame) {
    if (!isAuthenticated) return openAuth("login")
    setSelectedGame(game)
  }

  return (
    <div className="casino-app">
      <header className="casino-header">
        <div className="casino-header-left">
          <button className="casino-icon-button" onClick={() => setSidebarOpen((v) => !v)} aria-label="Toggle sidebar"><Menu /></button>
          <Image src="/logo.svg" alt={WEBSITE_NAME} width={42} height={42} priority className="casino-logo" />
          <button className="casino-top-button casino-bonus" onClick={() => openAuth("register")}><Image src="/casino-ui/assets/image-2.png" alt="" width={22} height={18} /> Bonuses</button>
          <button className="casino-top-button casino-search" onClick={() => setSearchOpen((v) => !v)} aria-label="Search games"><Search /></button>
        </div>
        <div className="casino-header-right">
          {authLoading ? <Loader2 className="casino-spinner" /> : isAuthenticated ? (
            <>
              <button className="casino-balance"><WalletCards /> <span>{formattedBalance}</span></button>
              <div className="casino-profile-wrap">
                <button className="casino-profile" onClick={() => setProfileOpen((v) => !v)}><UserRound /><span>{user?.username}</span><ChevronDown /></button>
                {profileOpen && <div className="casino-profile-menu"><div><strong>{user?.username}</strong><small>{user?.email}</small></div><button onClick={logout}><LogOut /> Log out</button></div>}
              </div>
            </>
          ) : (
            <><button className="casino-top-button" onClick={() => openAuth("login")}>Log in</button><button className="casino-signup" onClick={() => openAuth("register")}>Sign up</button></>
          )}
          <button className="casino-top-button casino-locale"><span>🇬🇧</span><span className="casino-divider"/><Languages /></button>
          <button className="casino-top-button casino-search" aria-label="Open chat"><MessageCircle /></button>
        </div>
        {searchOpen && <div className="casino-search-popover"><Search /><input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search games" aria-label="Search games"/><button onClick={() => {setSearchOpen(false);setQuery("")}} aria-label="Close search"><X /></button></div>}
      </header>

      <aside className={`casino-sidebar ${sidebarOpen ? "" : "casino-sidebar-closed"} ${mobileOpen ? "casino-sidebar-mobile" : ""}`}>
        <div className="casino-switches"><Link href="/" className="active"><Spade /> Casino</Link><Link href="/games/crash"><Trophy /> Sports</Link></div>
        <nav>{navItems.map(([label, Icon], i) => <Link key={label} href={i === 1 ? "/games/crash" : "/"} className={i === 0 ? "active" : ""}><Icon /><span>{label}</span>{i < 3 && <ChevronRight />}</Link>)}</nav>
        <div className="casino-side-bottom"><button onClick={() => openAuth("register")}><WalletCards /> Buy Crypto</button><p>{WEBSITE_NAME} App <span>iOS · Android</span></p></div>
      </aside>
      {mobileOpen && <button className="casino-scrim" onClick={() => setMobileOpen(false)} aria-label="Close navigation" />}

      <main className={`casino-main ${sidebarOpen ? "" : "casino-main-wide"}`}>
        <section className="casino-hero">
          <div className="casino-hero-copy"><h1><span>Your Crypto Adventure</span>Starts Here</h1><p>Play, earn and experience the power of crypto gaming</p><button onClick={() => openAuth("register")}>Start Playing</button></div>
          <Image src="/casino-ui/assets/image-3.png" alt={`${WEBSITE_NAME} gaming characters`} width={995} height={668} priority className="casino-hero-art" />
        </section>

        <div className="casino-content">
          <section className="casino-promos"><button onClick={() => openAuth("register")}><div><h2>Casino Welcome Pack</h2><p>Up to 590% + 225 Free Spins</p></div><Image src="/casino-ui/assets/image-5.png" alt="Dice" width={100} height={100}/></button><Link href="/games/crash"><div><h2>Sports Welcome Bonus</h2><p>100% First Deposit Bonus</p></div><Image src="/casino-ui/assets/image-6.png" alt="Football" width={100} height={100}/></Link></section>
          <button className="casino-crypto" onClick={() => openAuth("register")}><Image src="/casino-ui/assets/image-7.png" alt="Bitcoin" width={38} height={38}/><strong>Buy Crypto</strong><span>Buy crypto instantly with your bank card</span><ChevronRight /></button>

          {query.trim().length >= 2 ? <GameSection title={`Results for “${query}”`} games={results} loading={searchLoading} onPlay={play} /> : (
            <>
              {isLoading && <div className="casino-loading"><Loader2 /> Loading casino games…</div>}
              {error && <div className="casino-error">Casino games could not be loaded. Please try again.</div>}
              {rails.length ? rails.map((rail) => <GameSection key={rail._id} title={rail.name} games={rail.games.slice(0, 12)} onPlay={play} />) : !isLoading && <GameSection title="Top Slots" games={fallbackGames} onPlay={play} />}
            </>
          )}

          <section className="casino-buy"><h2>Get crypto in minutes and start playing</h2><div>G Pay &nbsp; Apple Pay &nbsp; Mastercard &nbsp; VISA</div><button onClick={() => openAuth("register")}>Buy Crypto</button></section>
          <section className="casino-originals"><div className="casino-section-head"><h2>{WEBSITE_NAME} Originals</h2><Link href="/games/crash">View All</Link></div><div className="casino-original-grid">{[15,16,17,18,19].map((n, i) => <button key={n} onClick={() => featured[i] ? play(featured[i]) : openAuth("login")}><Image src={`/casino-ui/assets/image-${n}.png`} alt={`${WEBSITE_NAME} original game`} fill sizes="194px" /></button>)}</div></section>
        </div>
        <footer className="casino-footer"><Image src="/logo.svg" alt={WEBSITE_NAME} width={42} height={42}/><p>Crypto Casino & Sports Betting</p><nav><a href="#">About</a><a href="#">Fairness</a><a href="#">Responsible Gaming</a><a href="#">Terms</a><a href="#">Support</a></nav><small>© 2026 {WEBSITE_NAME}. 18+ Play responsibly.</small></footer>
      </main>

      <nav className="casino-mobile-nav"><button onClick={() => setMobileOpen(true)}><Menu/><span>Menu</span></button><Link href="/"><Home/><span>Casino</span></Link><button className="primary" onClick={() => isAuthenticated ? setProfileOpen(true) : openAuth("register")}><UserRound/><span>{isAuthenticated ? "Account" : "Sign up"}</span></button><button onClick={() => setSearchOpen(true)}><Search/><span>Search</span></button></nav>
      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} initialMode={authMode} />
      <GameLaunchDialog game={selectedGame} onClose={() => setSelectedGame(null)} />
    </div>
  )
}

function GameSection({ title, games, loading, onPlay }: { title: string; games: CasinoGame[]; loading?: boolean; onPlay: (game: CasinoGame) => void }) {
  return <section className="casino-game-section"><div className="casino-section-head"><h2>{title}</h2><div><button aria-label="Previous"><ChevronLeft /></button><button aria-label="Next"><ChevronRight /></button></div></div>{loading ? <div className="casino-loading"><Loader2 /> Searching…</div> : games.length ? <div className="casino-game-strip">{games.map((game, index) => <button className="casino-game-card" key={game._id} onClick={() => onPlay(game)} aria-label={`Play ${game.game_name}`}><Image src={gameImage(game,index)} alt={game.game_name} fill sizes="194px" unoptimized/><span className="casino-top-pill">TOP</span><span className="casino-game-hover"><span className="casino-play">▶</span><strong>{game.game_name}</strong><small>{game.provider?.name || game.provider_code || WEBSITE_NAME}</small><Heart /></span></button>)}</div> : <p className="casino-empty">No games found.</p>}</section>
}

const fallbackGames: CasinoGame[] = fallbackArt.slice(0, 6).map((n, i) => ({ _id: `fallback-${n}`, game_code: `fallback-${n}`, game_name: ["Sugar Rush", "Sweet Bonanza", "Starlight Princess", `Gates of ${WEBSITE_NAME}`, "Burning Coins", "Merge Up 2"][i], banner: `/casino-ui/assets/image-${n}.png`, provider: { _id: "platform", name: i < 4 ? "Pragmatic Play" : WEBSITE_NAME } }))
