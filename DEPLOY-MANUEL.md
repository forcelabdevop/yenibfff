# Sunucuya Elle Kurulum

Bu dosya, deponun **elle** (script'siz) bir sunucuya kurulmasını anlatır.
Otomatik yol için `scripts/deploy.sh` + `deploy.env` kullanın.

Proje üç ayrı parçadır ve **üçü ayrı ayrı** derlenir:

| Parça      | Derleme çıktısı | Nasıl yayınlanır          |
| ---------- | --------------- | ------------------------- |
| `backend`  | (yok)           | pm2 ile süreç olarak çalışır |
| `frontend` | `frontend/out/` | statik dosya → web kökü   |
| `admin`    | `admin/dist/`   | statik dosya → web kökü   |

---

## ⚠ Önce bunu okuyun: `deploy.sh` admin'i derlemez

`scripts/deploy.sh` yalnızca **backend + frontend** yayınlar. `admin/` klasörüne
hiç dokunmaz.

Yani **Kripto Yatırmalar** sayfası (`apps/finance/crypto-deposits`) dahil,
admin panelinde yapılan hiçbir değişiklik o script'le sunucuya gitmez.
Admin'i her seferinde aşağıdaki **Adım 4**'teki gibi elle derleyip
kopyalamanız gerekir.

---

## Gereksinimler

Sunucuda kurulu olmalı:

- **Node.js** (backend `index.js` ile pm2 cluster modunda çalışır)
- **pnpm** — üç parça da pnpm lockfile kullanır
- **pm2** — backend süreç yöneticisi

aaPanel kullanıyorsanız `pnpm` ve `pm2` çoğu zaman `PATH`'te olmaz. Tam yolu
bulun ve komutlarda o yolu kullanın:

```bash
which pnpm || ls /www/server/nodejs/*/bin/pnpm
which pm2  || ls /www/server/nodejs/*/bin/pm2
```

---

## Adım 1 — Kodu çekin

```bash
cd /www/wwwroot/forcelab-repo      # deponun sunucudaki yolu
git fetch --all
git checkout main
git pull --ff-only
```

Hangi commit'te olduğunuzu not edin; geri dönmeniz gerekirse lazım olur:

```bash
git rev-parse --short HEAD
```

---

## Adım 2 — Backend

```bash
cd backend
pnpm install --frozen-lockfile
```

`--frozen-lockfile` önemli: lockfile ile `package.json` uyuşmazsa kurulum
sessizce farklı sürüm çekmek yerine **hata verir**.

### Ortam değişkenleri

`backend/.env` dosyasının dolu olduğundan emin olun. En kritik ikisi:

- `DATABASE_URI` — MongoDB bağlantısı
- `SERVER_PORT` — varsayılan `5000`

### Süreci yeniden yükleyin

```bash
pm2 reload ecosystem.config.js --update-env
```

`restart` değil **`reload`** kullanın. Backend cluster modunda 4 instance ile
çalışır; `reload` bunları sırayla yeniler, yani **kesinti olmaz**. `restart`
hepsini aynı anda düşürür.

`--update-env` şart: onsuz pm2 eski ortam değişkenlerini korur ve `.env`'de
yaptığınız değişiklik uygulanmaz.

### Doğrulayın

```bash
pm2 list                                   # süreç "online" mı
curl -sf http://127.0.0.1:5000/health      # 200 dönmeli
pm2 logs --lines 50                        # hata var mı
```

---

## Adım 3 — Frontend (statik site)

### Ortam değişkenleri — build ZAMANINDA gerekir

Next.js statik export ürettiği için bu değerler **derleme anında** koda gömülür.
Sonradan değiştirmek için **yeniden derlemek** gerekir.

Şunlar boşsa production build'i bilerek hata verir:

- `NEXT_PUBLIC_API_BASE_URL`
- `NEXT_PUBLIC_WEBSITE_NAME`

Bu bir güvenlik önlemi: aksi halde frontend, API adresi tanımsız şekilde
derlenip sunucuda sessizce çalışmaz hâlde yayınlanırdı.

### Derleyin

```bash
cd ../frontend
pnpm install --frozen-lockfile
pnpm run build
```

`build` iki iş yapar: önce casino-ui Tailwind CSS'ini üretir, sonra Next.js
statik export alır.

### Çıktıyı kontrol edin

```bash
test -f out/index.html && echo "build OK" || echo "BUILD BOŞ — yayınlamayın"
```

Bu dosya yoksa build başarısız olmuştur. **Kopyalamayın**, yoksa siteyi
boş bir dizinle değiştirirsiniz.

### Yayınlayın (atomik takas)

Doğrudan web köküne kopyalamayın — kopyalama sürerken site yarım kalır.
Yanına kurup **takas edin**:

```bash
WEB_ROOT=/www/wwwroot/velobet285.com

rm -rf "${WEB_ROOT}.new"
mkdir -p "${WEB_ROOT}.new"
cp -a out/. "${WEB_ROOT}.new/"

rm -rf "${WEB_ROOT}.bak"
mv "${WEB_ROOT}" "${WEB_ROOT}.bak"      # eski sürüm yedek kalsın
mv "${WEB_ROOT}.new" "${WEB_ROOT}"
```

Bir sorun çıkarsa geri alma tek komut:

```bash
rm -rf "${WEB_ROOT}" && mv "${WEB_ROOT}.bak" "${WEB_ROOT}"
```

---

## Adım 4 — Admin paneli

**Bu adım `deploy.sh`'de yoktur; her admin değişikliğinde elle yapılmalıdır.**

### Ortam değişkenleri — bunlar da build zamanında gömülür

`admin/.env` (veya `.env.production`) içinde:

- `VITE_API_BASE_URL` — backend adresi (zorunlu; boşsa panel hiçbir veri çekemez)
- `VITE_WEBSITE_NAME`
- `VITE_PROJECT_ID`

### Derleyin

```bash
cd ../admin
pnpm install --frozen-lockfile
pnpm run build
```

İlk kurulum uzun sürebilir: `postinstall` ve `prebuild` adımları Iconify ikon
setini derler.

### Çıktıyı kontrol edin

```bash
test -f dist/index.html && echo "admin build OK" || echo "BUILD BOŞ"
```

### Yayınlayın

```bash
ADMIN_ROOT=/www/wwwroot/panel.velobet285.com   # admin'in kendi web kökü

rm -rf "${ADMIN_ROOT}.new"
mkdir -p "${ADMIN_ROOT}.new"
cp -a dist/. "${ADMIN_ROOT}.new/"

rm -rf "${ADMIN_ROOT}.bak"
mv "${ADMIN_ROOT}" "${ADMIN_ROOT}.bak"
mv "${ADMIN_ROOT}.new" "${ADMIN_ROOT}"
```

### ⚠ Admin alt dizinde sunulamaz

Vite yapılandırmasında `base` tanımlı değil, yani varsayılan `/`. Panel
**alan adının kökünde** sunulmalıdır (`panel.site.com/` gibi).

`site.com/admin/` şeklinde alt dizine koyarsanız sayfa açılır ama tüm JS/CSS
istekleri `/assets/...` adresine gider ve **beyaz ekran** alırsınız. Alt dizin
şart ise önce `admin/vite.config.js` içine `base: '/admin/'` eklenmeli ve
yeniden derlenmelidir.

### SPA yönlendirmesi gerekir

Panel tek sayfa uygulamasıdır. Web sunucusu bilinmeyen yolları
`index.html`'e düşürmezse, kullanıcı bir sayfada **F5'e bastığında 404** alır.

nginx için:

```nginx
location / {
    try_files $uri $uri/ /index.html;
}
```

---

## Adım 5 — İzinler (yalnızca gerekirse)

Kripto Yatırmalar sayfası mevcut `finance.deposits.read` iznini kullanır.
Bu izin veritabanınızda zaten tanımlıysa ek bir şey yapmanız gerekmez.

Sayfa menüde **görünmüyorsa** izin katalogu eski demektir:

```bash
cd ../backend
pnpm run seed:permissions
```

Sonra panelde ilgili role `finance.deposits.read` iznini verin ve
**çıkıp yeniden giriş yapın** — yetkiler oturum açılışında yüklenir.

---

## Adım 6 — Kurulum sonrası doğrulama

Sırayla kontrol edin:

1. **Backend** — `pm2 list` hepsi `online`, `curl /health` 200
2. **Site açılıyor** — ana sayfa yükleniyor, konsolda hata yok
3. **Yatırma akışı** — giriş yapıp **Deposit**'e basın:
   - Currency **USDT**, Network **TRON (TRC-20)** dolu gelmeli
   - Adres ve QR görünmeli
   - Para birimini değiştirin: başlık, minimum tutar ve uyarı **aynı coini**
     göstermeli (uyuşmazlık olursa durun — yanlış ağa gönderim geri alınamaz)
4. **Admin** — Finans Yönetimi → **Kripto Yatırmalar** açılıyor, iki sekme de
   veri çekiyor

---

## Sorun giderme

| Belirti | Sebep |
| --- | --- |
| Build "must be set before building" hatası | `NEXT_PUBLIC_API_BASE_URL` / `NEXT_PUBLIC_WEBSITE_NAME` tanımsız |
| Site eski sürümü gösteriyor | Statik dosyalar kopyalanmadı ya da CDN/tarayıcı önbelleği |
| Panel beyaz ekran | Admin alt dizinde sunuluyor (`base` sorunu) |
| Panelde F5 → 404 | SPA yönlendirmesi (`try_files`) eksik |
| Panel açılıyor ama veri yok | `VITE_API_BASE_URL` yanlış ya da CORS |
| Menüde Kripto Yatırmalar yok | `finance.deposits.read` izni rolde tanımlı değil |
| `.env` değişikliği etkisiz | `pm2 reload` çağrısında `--update-env` unutulmuş |

### Tam geri alma

```bash
cd /www/wwwroot/forcelab-repo
git checkout <onceki-commit>

cd backend && pnpm install --frozen-lockfile
pm2 reload ecosystem.config.js --update-env

rm -rf "${WEB_ROOT}"   && mv "${WEB_ROOT}.bak"   "${WEB_ROOT}"
rm -rf "${ADMIN_ROOT}" && mv "${ADMIN_ROOT}.bak" "${ADMIN_ROOT}"
```
