"use client";

import Image from "next/image";
import Link from "next/link";
import {Bell, ChevronDown, Gift, Menu, MessageCircle, Search, Settings, Wallet} from "lucide-react";
import {useAuth} from "@/providers/auth-provider";
import {useWallet} from "@/providers/wallet-provider";
import {UserMenu} from "@/components/layout/user-menu";
import {WEBSITE_NAME} from "@/lib/config";

export function SiteHeader({onMenuToggle, onAuthOpen}: {onMenuToggle: () => void; onAuthOpen: (mode: "login" | "register") => void}) {
	const {isAuthenticated, isLoading} = useAuth();

	return (
		<header className="sticky top-0 z-40 flex h-[62px] items-center gap-2 border-b border-border bg-card px-3 md:h-[66px] md:gap-2 md:px-5">
			<button
				type="button"
				onClick={onMenuToggle}
				aria-label="Menüyü aç/kapat"
				className="hidden size-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:inline-flex"
			>
				<Menu className="size-6" strokeWidth={2.25} aria-hidden="true" />
			</button>

			<Link href="/" className="flex shrink-0 items-center gap-2 md:mr-2">
				<Image src="/logo.svg" alt={WEBSITE_NAME} width={42} height={42} priority className="size-10 md:size-9" />
				<span className="hidden bg-gradient-to-r from-foreground to-primary bg-clip-text text-lg font-extrabold tracking-tight text-transparent sm:inline md:text-xl">{WEBSITE_NAME}</span>
			</Link>

			<Link
				href="/casino"
				className="relative hidden h-12 items-center gap-3 rounded-xl bg-muted px-4 text-base font-bold text-foreground transition-colors hover:bg-muted/80 md:inline-flex md:min-w-[116px]"
			>
				<span className="relative">
					<Image src="/images/treasure.webp" alt="" width={28} height={28} className="size-7 object-contain" />
					<span className="absolute -top-1.5 -right-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-accent-foreground">2</span>
				</span>
				Bonuses
			</Link>

			<button type="button" aria-label="Ara" className="hidden size-12 items-center justify-center rounded-xl bg-muted text-foreground transition-colors hover:bg-muted/80 md:inline-flex">
				<Search className="size-6" strokeWidth={2.5} aria-hidden="true" />
			</button>

			<div className="ml-auto flex items-center gap-2 md:gap-2">
				<Link href="/casino" aria-label="Bonuslar" className="inline-flex size-10 items-center justify-center rounded-lg bg-muted text-accent md:hidden">
					<Gift className="size-5" aria-hidden="true" />
				</Link>
				{!isLoading && isAuthenticated ? (
					<>
						<BalancePill />
						<button
							type="button"
							className="btn-3d-primary hidden h-12 items-center justify-center rounded-xl px-5 text-sm font-bold text-primary-foreground transition-transform sm:inline-flex md:min-w-[100px]"
						>
							Deposit
						</button>
						<UserMenu />
						<div className="hidden h-12 items-center rounded-xl bg-muted md:flex">
							<button type="button" aria-label="Dil: İngilizce" className="flex size-12 items-center justify-center">
								<Image src="/images/en.svg" alt="" width={24} height={24} className="size-6 rounded-full" />
							</button>
							<span className="h-6 w-px bg-border" aria-hidden="true" />
							<button type="button" aria-label="Ayarlar" className="flex size-12 items-center justify-center text-foreground">
								<Settings className="size-6" aria-hidden="true" />
							</button>
						</div>
						<button type="button" aria-label="Bildirimler" className="relative hidden size-12 items-center justify-center rounded-xl bg-muted text-foreground md:inline-flex">
							<Bell className="size-6" aria-hidden="true" />
							<span className="absolute -top-1.5 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[11px] font-bold text-accent-foreground">11</span>
						</button>
						<Link href="/chat" aria-label="Sohbet" className="hidden size-12 items-center justify-center rounded-xl bg-muted text-foreground md:inline-flex">
							<MessageCircle className="size-6" aria-hidden="true" />
						</Link>
					</>
				) : !isLoading ? (
					<>
						<button
							type="button"
							onClick={() => onAuthOpen("login")}
							className="h-12 rounded-xl bg-muted px-3 text-xs font-semibold text-foreground/85 transition-colors hover:bg-muted/70 hover:text-foreground sm:px-5 sm:text-sm md:min-w-[70px]"
						>
							Giriş yap
						</button>
						<button
							type="button"
							onClick={() => onAuthOpen("register")}
							className="btn-3d-primary h-12 rounded-xl px-3 text-xs font-bold text-primary-foreground transition-transform sm:px-5 sm:text-sm md:min-w-[80px]"
						>
							Kayıt ol
						</button>
						<div className="hidden h-12 items-center rounded-xl bg-muted md:flex">
							<button type="button" aria-label="Dil: İngilizce" className="flex size-12 items-center justify-center">
								<Image src="/images/en.svg" alt="" width={24} height={24} className="size-6 rounded-full" />
							</button>
							<span className="h-6 w-px bg-border" aria-hidden="true" />
							<button type="button" aria-label="Ayarlar" className="flex size-12 items-center justify-center text-foreground">
								<Settings className="size-6" aria-hidden="true" />
							</button>
						</div>
						<Link href="/chat" aria-label="Sohbet" className="hidden size-12 items-center justify-center rounded-xl bg-muted text-foreground md:inline-flex">
							<MessageCircle className="size-6" aria-hidden="true" />
						</Link>
					</>
				) : (
					<div className="h-9 w-24 animate-pulse rounded-md bg-muted" aria-hidden="true" />
				)}
			</div>
		</header>
	);
}

function BalancePill() {
	const {formattedBalance, hasWallet} = useWallet();
	return (
		<button type="button" className="flex h-12 items-center gap-2 rounded-xl bg-muted px-2.5 text-foreground transition-colors hover:bg-muted/80">
			<span className="flex size-7 items-center justify-center rounded-full bg-background text-accent">
				<Wallet className="size-4" aria-hidden="true" />
			</span>
			<span className="tabular text-sm font-bold">{hasWallet ? formattedBalance : "—"}</span>
			<ChevronDown className="size-4 text-muted-foreground" aria-hidden="true" />
		</button>
	);
}
