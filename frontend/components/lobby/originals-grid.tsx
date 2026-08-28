"use client";

import Image from "next/image";
import Link from "next/link";
import {ChevronRight, Lock} from "lucide-react";
import {ORIGINAL_GAMES} from "@/lib/originals";
import {cn} from "@/lib/utils";
import {WEBSITE_NAME} from "@/lib/config";

export function OriginalsGrid() {
	return (
		<section id="originals" className="flex scroll-mt-16 flex-col gap-2.5">
			<div className="flex items-center justify-between">
				<h2 className="text-sm font-semibold text-foreground">{WEBSITE_NAME} Originals</h2>
				<Link href="/casino" className="flex items-center gap-1 text-[11px] font-semibold text-accent">
					Tümünü gör <ChevronRight className="size-3" aria-hidden="true" />
				</Link>
			</div>

			<div className="scrollbar-hidden -mx-3 flex gap-2 overflow-x-auto px-3 pb-1 md:-mx-5 md:px-5">
				{ORIGINAL_GAMES.map((game) => (
					<Link
						key={game.slug}
						href={game.live ? `/games/${game.slug}` : "#"}
						aria-disabled={!game.live}
						className={cn("group relative aspect-[4/5] w-28 shrink-0 overflow-hidden rounded-md bg-card sm:w-32", game.live ? "hover:ring-1 hover:ring-primary/70" : "cursor-default opacity-70")}
						onClick={(event) => {
							if (!game.live) event.preventDefault();
						}}
					>
						<Image src={game.image || "/placeholder.svg"} alt={game.name} fill sizes="128px" className="object-cover transition-transform duration-300 group-hover:scale-105" />
						<div className="absolute inset-0 bg-gradient-to-t from-background/95 via-transparent to-transparent" />
						{!game.live && (
							<span className="absolute right-1.5 top-1.5 rounded bg-background/80 p-1 text-muted-foreground">
								<Lock className="size-3" aria-hidden="true" />
							</span>
						)}
						<span className="absolute inset-x-2 bottom-2 truncate text-xs font-bold text-foreground">{game.name}</span>
					</Link>
				))}
			</div>
		</section>
	);
}
