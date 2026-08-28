import Link from "next/link"
import Image from "next/image"
import { ChevronRight } from "lucide-react"

/**
 * Referanstaki "Crypto & Earn" şeridi: 72px yüksekliğinde, 12px köşe
 * yarıçaplı düz #111923 zemin. Solda 40px kripto ikonu, ardından 22px/700
 * başlık, dikey ayraç ve 14px açıklama; en sağda ileri oku.
 */

export function CryptoEarnBar() {
  return (
    <Link
      href="#originals"
      className="group flex min-h-[72px] items-center gap-4 rounded-xl bg-[#111923] px-6 transition-colors hover:bg-[#151f2b]"
    >
      <Image src="/brands/bitcoin.svg" alt="" width={40} height={40} className="size-10 shrink-0" />

      <h2 className="shrink-0 font-bold text-foreground" style={{ fontSize: "22px", lineHeight: "24px" }}>
        Kripto &amp; Kazanç
      </h2>

      <span aria-hidden="true" className="hidden h-6 w-px shrink-0 bg-white/10 sm:block" />

      <p className="hidden flex-1 text-sm leading-[21px] text-white/[0.64] sm:block">
        %60&apos;a varan APR ile kripto kilitle, takas yap ve NFT dünyasını keşfet.
      </p>

      <ChevronRight
        className="ml-auto size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
        aria-hidden="true"
      />
    </Link>
  )
}
