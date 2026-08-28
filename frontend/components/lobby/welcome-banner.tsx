"use client"

import Image from "next/image"
import { ShieldCheck } from "lucide-react"
import { useAuth } from "@/providers/auth-provider"

/**
 * Referans hero ölçüleri (1448px genişlikte):
 * - Bölüm yüksekliği 380px, görsel sağa yaslı ve kenardan kenara.
 * - Başlık 36px / 900, uppercase, satır yüksekliği 40px, harf aralığı 0.72px.
 * - Alt satır 16px / 600, %70 opak beyaz.
 * - CTA 158x48, hızlı kayıt ikonları 46x44 ve 8px köşe yarıçapı.
 */

const QUICK_SIGNUP = [
  { id: "google", label: "Google ile kayıt ol", src: "/brands/google.svg" },
  { id: "metamask", label: "MetaMask ile kayıt ol", src: "/brands/metamask.svg" },
  { id: "telegram", label: "Telegram ile kayıt ol", src: "/brands/telegram.svg" },
  { id: "ton", label: "TON cüzdanı ile kayıt ol", src: "/brands/ton.svg" },
]

export function WelcomeBanner({ onSignUp }: { onSignUp: () => void }) {
  const { isAuthenticated } = useAuth()

  return (
    <section className="relative isolate flex min-h-[300px] items-center overflow-hidden bg-[#0b0d14] md:min-h-[380px]">
      {/* Sahne: stadyum + casino zemini. Kare görselden zemin ve slot makinesini
          içeren yatay bant gösterilir. */}
      <Image
        src="/banners/hero-bg.png"
        alt=""
        fill
        sizes="100vw"
        priority
        className="pointer-events-none object-cover object-[100%_55%]"
      />

      {/* Maskotu saran kırmızı sahne spotu */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(70% 90% at 68% 60%, rgba(228,42,50,0.34) 0%, rgba(150,22,32,0.16) 45%, rgba(11,13,20,0) 74%)",
        }}
      />

      <div className="pointer-events-none absolute bottom-[3%] top-[6%] right-[3%] w-[46%] max-w-[300px] sm:right-[15%] sm:w-[34%] sm:max-w-[340px]">
        {/* Maskotu zemine oturtan temas gölgesi */}
        <div
          className="absolute inset-x-[12%] bottom-0 h-[9%] rounded-[50%] blur-[10px]"
          style={{ background: "radial-gradient(50% 50% at 50% 50%, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0) 100%)" }}
        />
        <Image
          src="/banners/mascot.png"
          alt=""
          fill
          sizes="(min-width: 640px) 34vw, 46vw"
          priority
          className="object-contain object-bottom"
          style={{
            filter:
              "drop-shadow(0 0 26px rgba(232,48,56,0.5)) drop-shadow(0 14px 20px rgba(0,0,0,0.6)) saturate(1.08) contrast(1.04)",
          }}
        />
      </div>

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#0b0d14] via-[#0b0d14]/80 to-transparent sm:via-[#0b0d14]/45" />

      <div className="relative z-10 flex w-full flex-col px-4 py-10 sm:max-w-[56%] md:px-6">
        <h1
          className="text-[26px] font-black uppercase leading-[30px] tracking-[0.5px] text-primary sm:text-[36px] sm:leading-[40px] sm:tracking-[0.72px]"
        >
          Hoş geldin bonusu
          <span className="block text-foreground">%590&apos;a kadar</span>
        </h1>

        <p
          className="mt-[18px] font-semibold text-foreground/70"
          style={{ fontSize: "16px", lineHeight: "20px", letterSpacing: "-0.32px" }}
        >
          + 225 Free Spin
        </p>

        {!isAuthenticated && (
          <div className="mt-6 flex flex-wrap items-center gap-x-2 gap-y-3">
            <button
              type="button"
              onClick={onSignUp}
              className="btn-3d-primary mr-5 h-12 rounded-lg px-6 text-sm font-medium text-primary-foreground"
            >
              Kayıt ol ve oyna
            </button>

            {QUICK_SIGNUP.map((provider) => (
              <button
                key={provider.id}
                type="button"
                onClick={onSignUp}
                aria-label={provider.label}
                className="inline-flex h-11 w-[46px] items-center justify-center rounded-lg bg-white/[0.08] transition-colors hover:bg-white/[0.14]"
              >
                <Image src={provider.src} alt="" width={20} height={20} className="size-5" />
              </button>
            ))}
            <button
              type="button"
              onClick={onSignUp}
              aria-label="Anonim olarak kayıt ol"
              className="inline-flex h-11 w-[46px] items-center justify-center rounded-lg bg-white/[0.08] text-muted-foreground transition-colors hover:bg-white/[0.14] hover:text-foreground"
            >
              <ShieldCheck className="size-5" aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
    </section>
  )
}
