import Link from "next/link";
import Image from "next/image";
import {WEBSITE_NAME} from "@/lib/config";

/**
 * Referans "Casino" / "Sport" kartları (1448px genişlikte):
 * - Kart 126px yüksekliğinde, 12px köşe yarıçapı, aralarında 12px boşluk.
 * - Zemin koyu #111923 üzerine sağ üstten açılan radyal gradyan.
 * - Başlık 22px / 700, açıklama 14px ve %64 opak beyaz.
 * - Sağda 108x104 boyutunda hız çizgili 3D görsel.
 */

const CARDS = [
	{
		href: "/casino",
		title: "Casino",
		description: `${WEBSITE_NAME} Originals ve en iyi sağlayıcılardan casino oyunlarının tadını çıkar.`,
		image: "/promo/dice-3d.png",
		glow: "radial-gradient(84.67% 100% at 100% 0px, rgba(255, 0, 73, 0.66) 0px, rgba(255, 0, 73, 0) 100%)",
	},
	{
		href: "#originals",
		title: "Spor",
		description: "Yüksek oranlar ve daha fazla özellikle popüler spor etkinliklerine bahis yap.",
		image: "/promo/ball-3d.png",
		glow: "radial-gradient(84.08% 100% at 100% 0px, rgba(22, 143, 255, 0.66) 0px, rgba(22, 143, 255, 0) 100%)",
	},
];

export function PromoCards() {
	return (
		<div className="grid gap-3 sm:grid-cols-2">
			{CARDS.map((card) => (
				<Link key={card.title} href={card.href} className="group relative flex min-h-[126px] items-center overflow-hidden rounded-xl bg-[#111923]">
					<span aria-hidden="true" className="pointer-events-none absolute inset-0" style={{background: card.glow}} />

					<div className="relative z-10 flex max-w-[76%] flex-col gap-2 px-6 py-5">
						<h3 className="font-bold text-foreground" style={{fontSize: "22px", lineHeight: "28px"}}>
							{card.title}
						</h3>
						<p className="text-pretty text-sm leading-[21px] text-white/[0.64]">{card.description}</p>
					</div>

					<div className="pointer-events-none absolute right-2 top-1/2 h-[104px] w-[108px] -translate-y-1/2">
						<Image src={card.image} alt="" fill sizes="108px" className="object-contain transition-transform duration-300 group-hover:scale-105" />
					</div>
				</Link>
			))}
		</div>
	);
}
