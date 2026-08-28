import type { Metadata, Viewport } from "next"
import { Montserrat, Geist_Mono } from "next/font/google"
import { AppProviders } from "@/providers/app-providers"
import { WEBSITE_NAME } from "@/lib/config"
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
      <body className="font-sans antialiased">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  )
}
