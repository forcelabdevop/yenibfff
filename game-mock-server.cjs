// Gecici test sunucusu — sadece yerel dogrulama icin, deploy edilmez.
const http = require("http")

const GAME = {
  _id: "g1",
  game_code: "sugar-rush-super-scatter",
  game_name: "Sugar Rush Super Scatter",
  provider_code: "pragmatic",
  game_type: "Slot",
  technology: "HTML5",
  rtp: 96.51,
  is_mobile: true,
  has_freespins: true,
  has_tables: false,
  has_lobby: false,
  created_at: "2024-09-12T00:00:00.000Z",
  banner: "/uploads/games/sugar-rush.png",
  background: "/uploads/games/sugar-rush-bg.png",
}

function related(n) {
  return Array.from({ length: n }, (_, i) => ({
    _id: "r" + i,
    game_code: "related-game-" + i,
    game_name: "Related Game " + (i + 1),
    provider_code: "pragmatic",
    banner: "/uploads/games/related-" + i + ".png",
    background: "",
  }))
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://localhost")
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*")
  res.setHeader("Access-Control-Allow-Credentials", "true")
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization")
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
  res.setHeader("Content-Type", "application/json")

  if (req.method === "OPTIONS") {
    res.writeHead(204)
    return res.end()
  }

  if (url.pathname.startsWith("/public/games/detail/")) {
    return res.end(
      JSON.stringify({
        data: {
          game: GAME,
          provider: { code: "pragmatic", name: "slot_pragmatic_play" },
          categories: [{ _id: "c1", name: "Slots", img: "/uploads/cat/slots.png" }],
          providerGames: related(8),
          popularGames: related(6),
        },
      }),
    )
  }

  if (url.pathname === "/betinovi_api") {
    return res.end(
      JSON.stringify({
        status: 1,
        launch_url: "https://example.org/launch-demo",
      }),
    )
  }

  if (url.pathname.startsWith("/public/games")) {
    return res.end(JSON.stringify({ data: { games: related(12), categories: [], providers: [] } }))
  }

  res.end(JSON.stringify({ data: null }))
})

server.listen(5099, "127.0.0.1", () => console.log("[v0] mock api on 5099"))
