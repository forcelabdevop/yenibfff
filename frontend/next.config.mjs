/** @type {import('next').NextConfig} */

const publicEnv = {
  NEXT_PUBLIC_API_BASE_URL:
    process.env.NEXT_PUBLIC_API_BASE_URL || process.env.SERVER_BACKEND_URL,
  NEXT_PUBLIC_PROJECT_ID:
    process.env.NEXT_PUBLIC_PROJECT_ID || process.env.PROJECT_ID || "local",
  NEXT_PUBLIC_SOCKET_URL:
    process.env.NEXT_PUBLIC_SOCKET_URL || process.env.SERVER_BACKEND_URL,
  NEXT_PUBLIC_WEBSITE_NAME:
    process.env.NEXT_PUBLIC_WEBSITE_NAME || process.env.WEBSITE_NAME,
}

const requiredPublicEnv = ["NEXT_PUBLIC_API_BASE_URL", "NEXT_PUBLIC_WEBSITE_NAME"]
const missingPublicEnv = requiredPublicEnv.filter((name) => !publicEnv[name]?.trim())

if (process.env.NODE_ENV === "production" && missingPublicEnv.length) {
  throw new Error(`${missingPublicEnv.join(", ")} must be set before building the static frontend`)
}

const nextConfig = {
  // Frontend yalnızca statik dosya olarak yayınlanır.
  // output: "export" ciktisi standart "out/" klasorune yazilir; Vercel'in
  // Next.js preset'i bunu otomatik bulur. Ozel distDir vermiyoruz.
  output: "export",

  // trailingSlash KULLANMIYORUZ — bilerek.
  //
  // `trailingSlash: true` ile export dizin yapisi uretir (out/wallet/index.html)
  // ve kanonik adres `/wallet/` olur. Ancak bu projenin yayin ortami sondaki
  // egik cizgiyi SILIYOR: `/wallet/` icin 308 -> `/wallet` donuyor. Next ise
  // `/wallet` icin 308 -> `/wallet/` bekliyor. Sonuc: tarayici iki adres
  // arasinda sonsuz ziplayip ERR_TOO_MANY_REDIRECTS veriyor ("sizi cok fazla
  // kez yonlendirdi") ve hesap sayfalarinin hicbiri acilmiyor.
  //
  // Varsayilan (false) ile export duz dosyalar uretir (out/wallet.html) ve
  // sunucunun egik-cizgi-silen davranisiyla uyumlu olur.
  //
  // Buna geri eklemeden once TUM linkler egik cizgili olmali; su an tersi
  // gecerli (`/game?code=...`, `/wallet`) — karistirmak ayni dongu demek.

  // Deployment'ın server-side env adlarını static browser bundle'ına aktar.
  env: publicEnv,

  // Bazı build sandbox'ları ayrı tsc process'inin stdout'unu bozabiliyor.
  // TypeScript 5 kullanıldığı için aynı kontrolü compiler API ile yap.
  experimental: {
    useTypeScriptCli: false,
    webpackBuildWorker: false,
  },

  images: {
    // Static export'ta Next Image Optimization sunucusu bulunmaz. <Image>
    // boyut/lazy-loading davranışını korur, dosyayı doğrudan sunar.
    unoptimized: true,
    remotePatterns: [
      // Backend'in /uploads ve /public altındaki görselleri
      { protocol: "https", hostname: "**" },
      { protocol: "http", hostname: "localhost" },
    ],
  },
}

export default nextConfig
