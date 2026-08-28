"use client";

import {useState} from "react";
import Link from "next/link";
import {usePathname} from "next/navigation";
import {
	Award,
	Boxes,
	Cherry,
	ChevronRight,
	CircleDot,
	Clapperboard,
	Club,
	Crown,
	Dices,
	Disc3,
	Droplet,
	Gamepad2,
	Gift,
	Grid2x2,
	Package,
	PackageOpen,
	Palette,
	Rocket,
	Search,
	Sparkles,
	Spade,
	Swords,
	Ticket,
	User,
	Volleyball,
	X,
} from "lucide-react";
import {cn} from "@/lib/utils";
import {ORIGINAL_GAMES} from "@/lib/originals";
import {WEBSITE_NAME} from "@/lib/config";

interface SiteSidebarProps {
	desktopOpen: boolean;
	mobileOpen: boolean;
	onMobileClose: () => void;
}

const NAV_ICONS: Record<string, typeof Dices> = {
	crash: Sparkles,
	mines: Gamepad2,
	towers: Gamepad2,
	roll: Dices,
	blackjack: Spade,
	duels: Swords,
	battles: Swords,
	unbox: Package,
	upgrader: Boxes,
};

/** referans casino arayüzü sol menüsündeki üst grup — sıra ve ikonlar referansla birebir eşleşir. */
const CASINO_LINKS = [
	{label: "Slotlar", icon: Cherry, href: "/casino"},
	{label: "Canlı Casino", icon: Disc3, href: "/casino"},
	{label: "Masa Oyunları", icon: Grid2x2, href: "/casino"},
	{label: "NFT Kutuları", icon: PackageOpen, href: "/casino"},
	{label: "Sağlayıcılar", icon: User, href: "/casino"},
];

/** İkinci grup — referans casino arayüzü referansındaki alt liste sırasıyla aynı. */
const EXTRA_LINKS = [
	{label: "Hot Picks", icon: Droplet},
	{label: `${WEBSITE_NAME} Exclusives`, icon: Award},
	{label: "Buy Feature", icon: Ticket},
	{label: "Temalar", icon: Palette},
	{label: "Yeni Çıkanlar", icon: Rocket},
	{label: "Highroller Hall", icon: Crown},
	{label: "Game Shows", icon: Clapperboard},
	{label: "Rulet", icon: CircleDot},
	{label: "Blackjack", icon: Club},
];

export function SiteSidebar({desktopOpen, mobileOpen, onMobileClose}: SiteSidebarProps) {
	const pathname = usePathname();
	const [originalsOpen, setOriginalsOpen] = useState(false);

	return (
		<>
			{mobileOpen && <div className="fixed inset-0 z-30 bg-black/60 md:hidden" onClick={onMobileClose} aria-hidden="true" />}

			<aside
				aria-label="Ana menü"
				className={cn(
					"fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-border bg-card shadow-2xl transition-transform md:sticky md:top-16 md:z-0 md:h-[calc(100vh-4rem)] md:w-[228px] md:shrink-0 md:shadow-none md:transition-[width]",
					mobileOpen ? "translate-x-0" : "-translate-x-full",
					desktopOpen ? "md:flex md:translate-x-0" : "md:hidden",
				)}
			>
				<div className="flex items-center justify-between px-4 py-4">
					<span className="text-sm font-semibold text-foreground">Menü</span>
					<button
						type="button"
						onClick={onMobileClose}
						aria-label="Menüyü kapat"
						className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground md:hidden"
					>
						<X className="size-4" aria-hidden="true" />
					</button>
				</div>

				{/* Casino / Sports pill toggle — referans casino arayüzü'in üstteki iki büyük butonu. */}
				<div className="grid grid-cols-2 gap-2 px-3 pt-2">
					<NavPill href="/casino" active={pathname === "/casino" || pathname.startsWith("/games")} onClick={onMobileClose}>
						<Spade className="size-4" aria-hidden="true" />
						Casino
					</NavPill>
					<NavPill href="/" active={pathname === "/"} onClick={onMobileClose}>
						<Volleyball className="size-4" aria-hidden="true" />
						Spor
					</NavPill>
				</div>

				<nav className="flex-1 overflow-y-auto px-3 py-3">
					{/* Ara satırı — referansta pill'lerin altında, oyun listesinden önce. */}
					<NavLink href="/casino" active={false} onClick={onMobileClose}>
						<Search className="size-4" aria-hidden="true" />
						Ara
					</NavLink>

					<div className="my-3 border-t border-border" />

					{/* Marka Originals — referansta chevron'lu katlanabilir başlık. */}
					<button
						type="button"
						onClick={() => setOriginalsOpen((prev) => !prev)}
						aria-expanded={originalsOpen}
						className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
					>
						<Sparkles className="size-4" aria-hidden="true" />
						{WEBSITE_NAME} Originals
						<ChevronRight className={cn("ml-auto size-4 transition-transform", originalsOpen && "rotate-90")} aria-hidden="true" />
					</button>
					{originalsOpen && (
						<div className="flex flex-col gap-0.5 pl-2">
							{ORIGINAL_GAMES.map((game) => {
								const href = `/games/${game.slug}`;
								const Icon = NAV_ICONS[game.slug] ?? Gamepad2;
								return (
									<NavLink key={game.slug} href={href} active={pathname === href} onClick={onMobileClose}>
										<Icon className="size-4" aria-hidden="true" />
										{game.name}
										{!game.live && <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Yakında</span>}
									</NavLink>
								);
							})}
						</div>
					)}

					<div className="flex flex-col gap-0.5">
						{CASINO_LINKS.map((item) => (
							<NavLink key={item.label} href={item.href} active={false} onClick={onMobileClose}>
								<item.icon className="size-4" aria-hidden="true" />
								{item.label}
							</NavLink>
						))}
					</div>

					<div className="my-3 border-t border-border" />

					<div className="flex flex-col gap-0.5">
						{EXTRA_LINKS.map((item) => (
							<NavLink key={item.label} href="/casino" active={false} onClick={onMobileClose}>
								<item.icon className="size-4" aria-hidden="true" />
								{item.label}
							</NavLink>
						))}
						<NavLink href="/casino" active={false} onClick={onMobileClose}>
							<Gift className="size-4" aria-hidden="true" />
							Bonuslar
						</NavLink>
					</div>
				</nav>

				<div className="flex flex-col gap-3 border-t border-border px-4 py-4">
					<div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold text-muted-foreground/70">
						<span className="rounded border border-border px-1.5 py-0.5">BTC</span>
						<span className="rounded border border-border px-1.5 py-0.5">ETH</span>
						<span className="rounded border border-border px-1.5 py-0.5">USDT</span>
						<span className="rounded border border-border px-1.5 py-0.5">TRX</span>
					</div>
					<Link href="/casino" onClick={onMobileClose} className="rounded-md border border-border py-2 text-center text-sm font-semibold text-foreground transition-colors hover:bg-muted">
						Kripto satın al
					</Link>
					<p className="text-xs leading-relaxed text-muted-foreground">18+ · Sorumlu oyna.</p>
				</div>
			</aside>
		</>
	);
}

function NavPill({href, active, onClick, children}: {href: string; active: boolean; onClick: () => void; children: React.ReactNode}) {
	return (
		<Link
			href={href}
			onClick={onClick}
			className={cn(
				"flex items-center justify-center gap-1.5 rounded-lg py-2.5 text-sm font-bold transition-colors",
				active ? "bg-muted text-foreground" : "bg-background text-muted-foreground hover:bg-muted/60",
			)}
		>
			{children}
		</Link>
	);
}

function NavLink({href, active, onClick, children}: {href: string; active: boolean; onClick: () => void; children: React.ReactNode}) {
	return (
		<Link
			href={href}
			onClick={onClick}
			className={cn(
				"flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors",
				active ? "bg-gradient-to-r from-primary to-accent text-primary-foreground shadow-md shadow-primary/20" : "text-muted-foreground hover:bg-muted hover:text-foreground",
			)}
		>
			{children}
		</Link>
	);
}
