"use client";

import Link from "next/link";
import {useState} from "react";
import {ChevronDown, Github, Instagram, MessageCircle, Music2, ShieldCheck, Twitter, Youtube} from "lucide-react";
import {FOOTER_ACCORDION_GROUPS} from "@/lib/mock-lobby";
import {cn} from "@/lib/utils";
import {WEBSITE_NAME} from "@/lib/config";

const SOCIALS = [
	{id: "twitter", label: "Twitter", icon: Twitter},
	{id: "instagram", label: "Instagram", icon: Instagram},
	{id: "discord", label: "Discord", icon: MessageCircle},
	{id: "tiktok", label: "TikTok", icon: Music2},
	{id: "youtube", label: "YouTube", icon: Youtube},
	{id: "github", label: "Bitcointalk", icon: Github},
];

/**
 * referans casino arayüzü footer'ının birebir kopyası: I-GAMING / FEATURES / PROMO /
 * ABOUT US / CONTACT US / HELP akordiyon grupları, 18+ / SIQ / lisans
 * metni, sosyal medya ikon şeridi, kripto kur bilgisi ve copyright satırı.
 */
export function SiteFooter() {
	const [openId, setOpenId] = useState<string | null>(null);

	return (
		<footer className="mt-4 border-t border-border bg-card/40 px-3 py-6 md:px-5">
			<div className="mx-auto flex max-w-[1440px] flex-col gap-5">
				<div className="flex flex-col divide-y divide-border md:hidden">
					{FOOTER_ACCORDION_GROUPS.map((group) => {
						const isOpen = openId === group.id;
						return (
							<div key={group.id} className="py-1">
								<button type="button" onClick={() => setOpenId(isOpen ? null : group.id)} aria-expanded={isOpen} className="flex w-full items-center justify-between py-3 text-left">
									<span className="text-sm font-bold uppercase tracking-wide text-foreground">{group.title}</span>
									<ChevronDown className={cn("size-4 text-muted-foreground transition-transform", isOpen && "rotate-180")} aria-hidden="true" />
								</button>
								{isOpen && (
									<div className="flex flex-col gap-2.5 pb-3">
										{group.links.map((link) => (
											<Link key={link.label} href={link.href} className="text-sm text-muted-foreground/80 transition-colors hover:text-foreground">
												{link.label}
											</Link>
										))}
									</div>
								)}
							</div>
						);
					})}
				</div>

				<div className="hidden grid-cols-3 gap-6 md:grid md:grid-cols-6">
					{FOOTER_ACCORDION_GROUPS.map((group) => (
						<div key={group.id} className="flex flex-col gap-2.5">
							<p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{group.title}</p>
							{group.links.map((link) => (
								<Link key={link.label} href={link.href} className="text-sm text-muted-foreground/80 transition-colors hover:text-foreground">
									{link.label}
								</Link>
							))}
						</div>
					))}
				</div>

				<div className="flex flex-col gap-4 border-t border-border pt-6">
					<div className="flex items-center gap-2.5">
						<span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted px-2.5 py-1 text-xs font-bold text-foreground">18+</span>
						<span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted px-2.5 py-1 text-xs font-bold text-foreground">
							<ShieldCheck className="size-3.5 text-primary" aria-hidden="true" />
							SIQ
						</span>
					</div>

					<div className="flex items-center gap-3">
						{SOCIALS.map((social) => (
							<a
								key={social.id}
								href="#"
								aria-label={social.label}
								className="inline-flex size-9 items-center justify-center rounded-full border border-border bg-muted text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
							>
								<social.icon className="size-4" aria-hidden="true" />
							</a>
						))}
					</div>

					<p className="max-w-3xl text-xs leading-relaxed text-muted-foreground">
						18+ Bu web sitesi risk içeren oyun deneyimi sunar. Sitemizin kullanıcısı olmak için 18 yaşından büyük olmanız gerekir. Yerel yasalarınızın ihlalinden sorumlu değiliz.
						{WEBSITE_NAME}&apos;da sorumlu bir şekilde oynayın ve keyfini çıkarın.
					</p>
					<p className="max-w-3xl text-xs leading-relaxed text-muted-foreground/70">
						{WEBSITE_NAME}, Universe B Games N.V. şirketinin bir marka adıdır. Şirket Adresi: Dr. H. Fergusonweg 1, Curaçao. {WEBSITE_NAME}, Curaçao Gaming Control Board tarafından
						geçerli Faaliyet Sertifikası kapsamında faaliyet göstermeye yetkilidir.
					</p>

					<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
						<div className="flex items-center gap-3 text-xs font-semibold text-muted-foreground/70">
							<span>Bitcoin</span>
							<span>Ethereum</span>
							<span>Tether</span>
							<span>Tron</span>
						</div>
						<span className="text-xs text-muted-foreground/60">1 ₺ = $0.02</span>
					</div>

					<p className="text-xs text-muted-foreground/60">Copyright &copy; 2024-{new Date().getFullYear()} {WEBSITE_NAME}. Tüm hakları saklıdır.</p>
				</div>
			</div>
		</footer>
	);
}
