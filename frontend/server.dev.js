/**
 * Sadece sandbox/geliştirme testi için: `next dev` yerine bu custom server
 * kullanılırsa, /socket.io/* isteklerinin websocket upgrade'i de dahil olmak
 * üzere backend'e proxy'lenmesini sağlar. Standart `next dev`'in rewrites()
 * mekanizması websocket upgrade'ini taşımadığı için, sandbox'ta sadece 5173
 * portu dışa açıkken Socket.IO'yu test edebilmek için gereklidir.
 *
 * Production'da KULLANILMAZ: orada backend kendi gerçek domain/subdomain'inde
 * çalışır ve frontend doğrudan o adrese bağlanır (bkz. lib/config.ts).
 */
const { createServer } = require("http")
const { parse } = require("url")
const { loadEnvConfig } = require("@next/env")
const next = require("next")
const httpProxy = require("http-proxy")

// Custom server, Next.js başlatılmadan önce process.env'i okuduğu için proje
// değişkenlerini açıkça yükle. Aksi halde oyun proxy'si localhost:5000'e düşer.
loadEnvConfig(process.cwd())

const PORT = Number(process.env.PORT) || 5173
const BACKEND_URL = process.env.NEXT_PUBLIC_SOCKET_URL || process.env.NEXT_PUBLIC_API_BASE_URL || process.env.SERVER_BACKEND_URL || "http://localhost:5000"

const app = next({ dev: true })
const handle = app.getRequestHandler()
const proxy = httpProxy.createProxyServer({
  target: BACKEND_URL,
  ws: true,
  changeOrigin: true,
})

proxy.on("error", (err, _req, res) => {
  console.error("[socket-proxy] error:", err.message)
  if (res && !res.headersSent) {
    res.writeHead(502)
    res.end("socket proxy error")
  }
})

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url, true)
    if (parsedUrl.pathname?.startsWith("/socket.io")) {
      proxy.web(req, res)
      return
    }
    handle(req, res, parsedUrl)
  })

  server.on("upgrade", (req, socket, head) => {
    if (req.url?.startsWith("/socket.io")) {
      proxy.ws(req, socket, head)
      return
    }
    // Next.js HMR websocket'i kendi upgrade handler'ına bırak.
    app.getUpgradeHandler()(req, socket, head)
  })

  server.listen(PORT, () => {
    console.log(`> Ready (custom server, socket.io proxy aktif) on http://localhost:${PORT}`)
  })
})
