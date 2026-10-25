import { createServer } from "node:http"
import { createReadStream, existsSync, statSync } from "node:fs"
import { extname, join, normalize, resolve, sep } from "node:path"
import { fileURLToPath } from "node:url"

const variant = process.argv[2] === "mobile" ? "mobile" : "desktop"
const port = Number(process.env.PORT || 3000)
const root = resolve(fileURLToPath(new URL(`../frontend/${variant}`, import.meta.url)))

const MIME = {
	".html": "text/html; charset=utf-8",
	".js": "text/javascript; charset=utf-8",
	".css": "text/css; charset=utf-8",
	".json": "application/json; charset=utf-8",
	".svg": "image/svg+xml",
	".png": "image/png",
	".jpg": "image/jpeg",
	".jpeg": "image/jpeg",
	".gif": "image/gif",
	".webp": "image/webp",
	".ico": "image/x-icon",
	".woff": "font/woff",
	".woff2": "font/woff2",
	".ttf": "font/ttf",
	".txt": "text/plain; charset=utf-8",
	".map": "application/json",
}

function resolveFile(urlPath) {
	const safe = normalize(decodeURIComponent(urlPath)).replace(/^(\.\.[/\\])+/, "")
	const candidate = join(root, safe)
	if (candidate !== root && !candidate.startsWith(root + sep)) return null
	if (existsSync(candidate) && statSync(candidate).isFile()) return candidate
	if (existsSync(candidate) && statSync(candidate).isDirectory()) {
		const index = join(candidate, "index.html")
		if (existsSync(index)) return index
	}
	return null
}

createServer((req, res) => {
	const { pathname } = new URL(req.url, "http://localhost")
	// SPA: bilinmeyen yollar (istemci tarafı rotalar) index.html'e düşer
	const file = resolveFile(pathname) || join(root, "index.html")
	res.writeHead(200, {
		"Content-Type": MIME[extname(file).toLowerCase()] || "application/octet-stream",
		"Cache-Control": "no-cache",
	})
	createReadStream(file).pipe(res)
}).listen(port, "0.0.0.0", () => {
	console.log(`[frontend:${variant}] http://localhost:${port}  (root: ${root})`)
})
