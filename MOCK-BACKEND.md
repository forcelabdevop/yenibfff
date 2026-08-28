# Offline (mock) backend modu — ve backend'e geri bağlama rehberi

> **Durum:** ŞU AN AÇIK. Frontend backend'e bağlı değil, oturum sahte.
> Bu dosya, "backende tümünü bağla" dendiğinde hiçbir şeyin kaçmaması için var.

---

## 1. Neden var?

Sandbox/önizleme ortamından gerçek backend'e (`NEXT_PUBLIC_API_BASE_URL`,
prod'da `apivelobet.com`) erişilemiyor:

- `GET /user/:id` çalışmadığı için `isAuthenticated` her zaman `false` kalıyordu.
- Bu yüzden **oturum gerektiren tüm sayfalar hiç render edilmiyordu**:
  `/wallet`, `/profile`, `/account`, `/transactions`, `/game-history`,
  `/sessions`, `/vault` ve oyun sayfasının başlatma akışı.
- Lobi/oyun listeleri de boş dönüyordu, yani tasarım bitirilemiyordu.

Çözüm: uygulama koduna dokunmadan, **sadece `window.fetch`'i saran** tek dosyalık
geçici bir katman.

## 2. Nasıl çalışıyor?

Tek dosya: **`frontend/public/casino-ui/mock-backend.js`**

| Ne yapar | Nasıl |
| --- | --- |
| Sahte oturum açar | `localStorage`'a `<ns>.token` ve `<ns>.userId` yazar. Hem casino-ui hem Next tarafı aynı anahtarları okuduğu için ikisi de "giriş yapılmış" olur. |
| API yanıtları üretir | `window.fetch` sarmalanır. Sadece `API_BASE` origin'ine giden istekler yakalanır; statik dosyalar/`_next` istekleri dokunulmadan geçer. |
| Socket'i susturur | casino-ui için `window.io` stub'lanır; Next için `lib/socket.ts` içinde `__MOCK_BACKEND__` guard'ı var. |
| Eksikleri gizlemez | Mocklanmamış bir uca istek gidince konsola `[mock-backend] eslesmeyen uc: ...` uyarısı basar ve **503** döner. |

İki yerden yüklenir:

1. `frontend/public/casino-ui/index.html` `<head>` — socket.io'dan **sonra**,
   `game-detail.js`'ten **önce**.
2. `frontend/app/layout.tsx` — `<Script strategy="beforeInteractive">`
   (`data-api-base` + `data-storage-namespace` attribute'larıyla).

**Kritik kural:** her mock yanıtı, backend'in gerçek yanıt şekliyle birebir aynı
alan adlarını kullanır. Uygulama kodunda "mock ise şunu yap" diye bir dal
**yoktur** — bu yüzden geri bağlanmak kod değişikliği değil, katmanı kapatmaktır.

## 3. Açma / kapatma

| Yöntem | Nasıl | Kalıcılık |
| --- | --- | --- |
| Kalıcı kapatma | `mock-backend.js` içindeki `MOCK_ENABLED_BY_DEFAULT = false` | kodda |
| Hızlı deneme | URL'ye `?mock=0` (açmak için `?mock=1`) | localStorage'a yazılır |
| Elle | `localStorage.setItem("<ns>.mockBackend", "0")` | tarayıcı |

`<ns>` = `STORAGE_NAMESPACE` = site adının slug'ı (örn. `forcelab`).

---

## 4. BACKEND'E GERİ BAĞLAMA — kontrol listesi

### 4.1 Zorunlu adımlar (bunlar olmadan hiçbir şey çalışmaz)

- [ ] **1. Katmanı kapat.** `frontend/public/casino-ui/mock-backend.js` →
      `MOCK_ENABLED_BY_DEFAULT = false`.
- [ ] **2. Script etiketlerini kaldır** (temizlik; kapalıyken zararsız ama
      gereksiz istek):
      - `frontend/public/casino-ui/index.html` içindeki
        `<script src="./mock-backend.js"></script>` satırı ve yorumu.
      - `frontend/app/layout.tsx` içindeki `<Script src="/casino-ui/mock-backend.js" ...>`
        bloğu ve artık kullanılmayan `Script` / `API_BASE` / `STORAGE_NAMESPACE`
        import'ları (import'ları **kullanım silindikten sonra** kaldır).
- [ ] **3. Socket guard'ını kaldır.** `frontend/lib/socket.ts` içindeki
      `createOfflineSocket` + `mockBackendActive` fonksiyonları ve `getSocket`
      başındaki `if (mockBackendActive())` bloğu.
- [ ] **4. Sahte oturumu temizle.** Tarayıcıda `localStorage.clear()` ya da en az
      `<ns>.token`, `<ns>.userId`, `<ns>.mockBackend` anahtarlarını sil. Aksi
      halde gerçek backend `mock.session.token` ile 401 döner ve kullanıcı
      "giriş yapmış ama veri yok" durumunda kalır.
- [ ] **5. Env değişkenlerini doğrula.** `NEXT_PUBLIC_API_BASE_URL` ve
      `NEXT_PUBLIC_WEBSITE_NAME` set olmalı — `next.config.mjs` production
      build'i bunlar yoksa **bilerek** patlatır (static export, backend URL'sini
      bundle'a gömer). Ayrıca socket ayrı hosttaysa `NEXT_PUBLIC_SOCKET_URL`.
- [ ] **6. Backend CORS + `credentials: 'include'`.** Tüm istekler
      `credentials: "include"` ile gidiyor; backend `Access-Control-Allow-Origin`
      olarak **tam origin** döndürmeli (`*` ile credentials çalışmaz) ve
      `Access-Control-Allow-Credentials: true` vermeli.
- [ ] **7. `mock-backend.js` dosyasını sil.** Artık gerekmiyorsa
      `frontend/public/casino-ui/mock-backend.js` ve bu doküman kaldırılabilir.
      (Tekrar lazım olabileceği için silmeden önce commit geçmişinde olduğundan
      emin ol.)

### 4.2 Kapatınca ÇALIŞMAYA BAŞLAYACAK olanlar (mockta zorunlu olarak eksikti)

| Konu | Mockta durum | Gerçek backend'de |
| --- | --- | --- |
| Gerçek oyun başlatma | `POST /betinovi_api` bilerek `status: 0` + "sağlayıcı offline" döner | Sağlayıcıdan `{ status: 1, launch_url }` gelir, iframe'e yüklenir |
| Canlı chat / online sayacı | socket stub, hiç veri akmaz | `/general` namespace bağlanır |
| Canlı bahis akışı, crash vb. | akmaz | ilgili namespace'ler bağlanır |
| Kasa (vault) transferi | bellekte tutulur, sayfa yenilenince sıfırlanır | MongoDB transaction, kalıcı |
| Para yatırma/çekme (cashier) | **hiç mocklanmadı**, 503 döner | gerçek ödeme akışı |
| Bonus merkezi / promo kod | **hiç mocklanmadı**, 503 döner | bkz. `BONUS_MERKEZI_API.md`, `PROMO_CODE_API.md` |

### 4.3 Bağlandıktan sonra doğrulama sırası

1. `GET /user/:id` 200 dönüyor mu → üst bar bakiye/rütbe geliyor mu?
2. `/public/games/categories/with-games` → lobi rafları dolu mu?
3. `/public/games/detail/:code` → oyun sayfası + "Top 3 wins" + iki karusel?
4. `POST /betinovi_api` → gerçek `launch_url` iframe'e yükleniyor mu?
5. `/account/overview` → 7 hesap sayfası (özellikle `/wallet`, `/vault`)?
6. `/transaction-history/:userId` ve `/game-history/:userId` → tablolar?
7. Konsolda `[mock-backend]` satırı **görünmemeli**.

---

## 5. Mocklanan uçların tam listesi (backend kontratı referansı)

`mock-backend.js` içindeki `ROUTES` tablosu. Alan adları şu kaynaklardan
birebir alındı:

| Uç | Metot | Yanıt şekli | Backend kaynağı |
| --- | --- | --- | --- |
| `/user/:id` | GET | `User` dokümanı (düz) | `backend/routes/index.js` |
| `/auth/credentials` | POST | `{ token, userId, user }` | `providers/auth-provider.tsx` beklentisi |
| `/auth/credentials/register` | POST | `{ token, userId, user }` | ” |
| `/auth/credentials/mfa/validate-otp` | POST | `{ token, userId }` | ” |
| `/public/games/categories/with-games` | GET | `{ data: [{...cat, total_games, games }] }` | `apiController.getCategoriesWithGames` |
| `/public/categories` | GET | `Category[]` | `apiController` |
| `/public/games/featured/list` | GET | `Game[]` | ” |
| `/public/games/category/:slug` | GET | `Game[]` | ” |
| `/public/games/search?query=` | GET | `Game[]` | `apiController.searchGames` |
| `/public/games/detail/:code` | GET | `{ success, data: { game, provider, categories, topWins, providerGames, popularGames } }` | `apiController.getGameDetailByCode` |
| `/account/overview` | GET | `{ success, data: { profile, security, wallet, vault, stats } }` | `backend/routes/account/index.js` |
| `/account/sessions` | GET | `{ success, sessions: [{ _id, at, ip, userAgent }] }` | ” |
| `/account/vault` | GET | `{ success, data: { balances, total, locked, expireAt, activeWallet, activeBalance } }` | ” |
| `/account/vault/deposit\|withdraw` | POST | `{ success, data: { balances, total, activeBalance } }` | ” |
| `/transaction-history/:userId` | GET | `{ transactions: [...] }` | `backend/routes/index.js` |
| `/game-history/:identifier` | GET | `{ history: [...], pagination }` | ” |
| `/betinovi_api` | POST | `{ status: 0, msg, details }` (bilerek hata) | ” |

### Dikkat edilen alan adı tuzakları

- `topWins` → `username` / `bet_money` / `win_money` / `multiplier` / `created_at`
  (`user` / `amount` **değil**).
- Cüzdan tek "Rivo" modeli: `{ coinType: "Rivo", chain: "TRON", type: "trc-20" }`
  — `backend/utils/rivoWallet.js`.
- `User.rank` bir **rol** alanıdır (`"user"`), VIP seviyesi değil
  (`backend/database/models/User.js:130`). Mock da öyle döndürüyor; arayüzde
  seviye göstergesi varsa bu backend'de henüz karşılığı olmayan bir alandır.
- `/transaction-history` yanıtı `{ transactions }`, `/game-history` yanıtı
  `{ history, pagination }` — ikisi farklı.
- Hesap uçları **userId'yi URL'den almaz**, `req.user._id`'den alır (IDOR
  koruması). Mock da aynı davranır.
