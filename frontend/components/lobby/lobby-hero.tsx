"use client";

import {useCallback, useEffect, useRef, useState} from "react";
import Link from "next/link";
import Image from "next/image";
import {ArrowRight, ChevronLeft, ChevronRight} from "lucide-react";
import {cn} from "@/lib/utils";
import {WEBSITE_NAME} from "@/lib/config";

interface Banner {
	id: string;
	badge: string;
	title: string;
	description: string;
	cta: string;
	href: string;
	image: string;
}

const BANNERS: Banner[] = [
	{
		id: "crash",
		badge: "Şimdi canlı",
		title: "Roketi fırlat, doğru anda çık.",
		description: "Crash'te çarpan her an artar — cashout'u zamanla ya da her şeyi kaybet. Canlı bahisleri izle, kendi turunu oyna.",
		cta: "Crash'i oyna",
		href: "/games/crash",
		image: "/games/crash.png",
	},
	{
		id: "casino",
		badge: "Binlerce oyun",
		title: "Slot dünyasını keşfet.",
		description: "Onlarca sağlayıcıdan binlerce slot ve masa oyunu bir arada — kategori kategori gez, favorini bul.",
		cta: "Casino'ya git",
		href: "/casino",
		image: "/banners/casino-slots.png",
	},
	{
		id: "originals",
		badge: `${WEBSITE_NAME} Originals`,
		title: "Kendi oyunlarımızı oyna.",
		description: "Mines, Towers, Roll ve daha fazlası — stüdyomuzun imzasını taşıyan orijinal oyunlar çok yakında burada.",
		cta: "Originals'ı gör",
		href: "#originals",
		image: "/banners/originals.png",
	},
];

export function LobbyHero() {
	const trackRef = useRef<HTMLDivElement>(null);
	const [activeIndex, setActiveIndex] = useState(0);

	const handleScroll = useCallback(() => {
		const track = trackRef.current;
		if (!track) return;
		const slideWidth = track.firstElementChild?.clientWidth ?? 1;
		const gap = 12;
		const index = Math.round(track.scrollLeft / (slideWidth + gap));
		setActiveIndex(Math.min(index, BANNERS.length - 1));
	}, []);

	useEffect(() => {
		const track = trackRef.current;
		if (!track) return;
		track.addEventListener("scroll", handleScroll, {passive: true});
		return () => track.removeEventListener("scroll", handleScroll);
	}, [handleScroll]);

	function scrollToIndex(index: number) {
		const track = trackRef.current;
		if (!track) return;
		const slide = track.children[index] as HTMLElement | undefined;
		if (!slide) return;
		track.scrollTo({left: slide.offsetLeft - track.offsetLeft, behavior: "smooth"});
	}

	function scrollBy(direction: -1 | 1) {
		scrollToIndex(Math.max(0, Math.min(BANNERS.length - 1, activeIndex + direction)));
	}

	return (
		<section className="relative flex flex-col gap-3">
			<div ref={trackRef} className="scrollbar-hidden -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 md:-mx-6 md:px-6">
				{BANNERS.map((banner) => (
					<BannerSlide key={banner.id} banner={banner} />
				))}
			</div>

			<div className="flex items-center justify-between px-1">
				<div className="flex items-center gap-1.5">
					{BANNERS.map((banner, i) => (
						<button
							key={banner.id}
							type="button"
							aria-label={`${i + 1}. banner'a geç`}
							aria-current={i === activeIndex}
							onClick={() => scrollToIndex(i)}
							className={cn("h-1.5 rounded-full transition-all", i === activeIndex ? "w-6 bg-primary" : "w-1.5 bg-muted-foreground/40 hover:bg-muted-foreground/70")}
						/>
					))}
				</div>

				<div className="hidden items-center gap-1.5 sm:flex">
					<button
						type="button"
						aria-label="Önceki"
						disabled={activeIndex === 0}
						onClick={() => scrollBy(-1)}
						className="inline-flex size-8 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground disabled:opacity-40"
					>
						<ChevronLeft className="size-4" aria-hidden="true" />
					</button>
					<button
						type="button"
						aria-label="Sonraki"
						disabled={activeIndex === BANNERS.length - 1}
						onClick={() => scrollBy(1)}
						className="inline-flex size-8 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground disabled:opacity-40"
					>
						<ChevronRight className="size-4" aria-hidden="true" />
					</button>
				</div>
			</div>
		</section>
	);
}

function BannerSlide({banner}: {banner: Banner}) {
	return (
		<Link
			href={banner.href}
			className="group relative flex h-44 w-[88%] shrink-0 snap-start overflow-hidden rounded-lg border border-border bg-card sm:h-44 sm:w-[58%] md:h-[182px] md:w-[43%] lg:w-[29%]"
		>
			<Image
				src={banner.image || "/placeholder.svg"}
				alt=""
				fill
				sizes="(min-width: 1024px) 48vw, (min-width: 768px) 58vw, 88vw"
				priority={banner.id === "crash"}
				className="object-cover transition-transform duration-500 group-hover:scale-105"
			/>
			<div className="absolute inset-0 bg-gradient-to-r from-background via-background/70 to-transparent" />

			<div className="relative z-10 flex max-w-[78%] flex-col justify-center gap-2 p-5 sm:max-w-[72%] sm:p-5">
				<span className="inline-flex w-fit items-center rounded-full border border-primary/30 bg-primary/15 px-2.5 py-1 text-[11px] font-semibold text-primary">{banner.badge}</span>
				<h2 className="text-balance text-lg font-extrabold uppercase leading-[1.05] text-foreground sm:text-xl">{banner.title}</h2>
				<p className="hidden text-pretty text-sm leading-relaxed text-muted-foreground sm:block">{banner.description}</p>
				<span className="btn-3d-primary mt-1 inline-flex w-fit items-center gap-1.5 rounded-md px-3.5 py-2 text-sm font-bold text-primary-foreground">
					{banner.cta}
					<ArrowRight className="size-4" aria-hidden="true" />
				</span>
			</div>
		</Link>
	);
}
