import type { Metadata, Viewport } from "next"
import Script from "next/script"
import { Montserrat, Geist_Mono } from "next/font/google"
import { AppProviders } from "@/providers/app-providers"
import { API_BASE, STORAGE_NAMESPACE, WEBSITE_NAME } from "@/lib/config"
import "./globals.css"

const _montserrat = Montserrat({ subsets: ["latin"], variable: "--font-montserrat" })
const _geistMono = Geist_Mono({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: `${WEBSITE_NAME} — Crypto Casino & Sports Betting`,
  description: `Crypto casino games, sports betting, staking and ${WEBSITE_NAME} Originals in one place.`,
  applicationName: WEBSITE_NAME,
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    siteName: WEBSITE_NAME,
    title: `${WEBSITE_NAME} — Crypto Casino & Sports Betting`,
    description: "Crypto casino games, sports betting and staking in one place.",
  },
}

export const viewport: Viewport = {
  themeColor: "#0d131c",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  userScalable: true,
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="bg-background">
      <head>
        {/*
          GEÇİCİ: offline/mock backend katmanı. Backend'e erişilemediği için
          giriş yapılamıyor ve oturum gerektiren sayfalar boş kalıyordu.
          `beforeInteractive` şarttır — window.fetch, herhangi bir bileşen
          istek atmadan önce sarılmalı.
          Backend'e geri bağlanırken bu <Script> bloğu silinir; ayrıntılı
          kontrol listesi: MOCK-BACKEND.md
        */}
        <Script
          src="/casino-ui/mock-backend.js"
          strategy="beforeInteractive"
          data-api-base={API_BASE}
          data-storage-namespace={STORAGE_NAMESPACE}
        />
      </head>
      <body className="font-sans antialiased">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  )
}
