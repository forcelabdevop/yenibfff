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
WEB_ROOT=/www/wwwroot/ornek.com   # <-- KENDİ YOLUNUZU YAZIN

# Guard: yanlış/yer tutucu yol sessizce çöp klasör oluşturmasın.
case "$WEB_ROOT" in
  /*) ;;
  *) echo "HATA: WEB_ROOT mutlak yol olmalı"; return 2>/dev/null || exit 1 ;;
esac
[ -d "$WEB_ROOT" ] || { echo "HATA: $WEB_ROOT yok. Doğru yolu bulun."; return 2>/dev/null || exit 1; }
[ -f out/index.html ] || { echo "HATA: out/index.html yok, önce build alın."; return 2>/dev/null || exit 1; }

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

Önce **gerçek** web kökünü bulun. Aşağıdaki yol bir tahmindir; sizin
sunucunuzda farklı olabilir:

```bash
# nginx hangi klasörü sunuyor?
grep -RE "server_name|root " /www/server/panel/vhost/nginx/ | grep -i panel
```

Bulduğunuz yolu yazın ve **kopyala-yapıştır yapmadan önce değiştirin**:

```bash
ADMIN_ROOT=/www/wwwroot/panel.ornek.com   # <-- KENDİ YOLUNUZU YAZIN

# Guard: yanlış/yer tutucu yol sessizce çöp klasör oluşturmasın.
case "$ADMIN_ROOT" in
  /*) ;;
  *) echo "HATA: ADMIN_ROOT mutlak yol olmalı (/ ile başlamalı)"; return 2>/dev/null || exit 1 ;;
esac
[ -d "$ADMIN_ROOT" ] || { echo "HATA: $ADMIN_ROOT yok. Doğru yolu bulun."; return 2>/dev/null || exit 1; }
[ -f dist/index.html ] || { echo "HATA: dist/index.html yok, önce build alın."; return 2>/dev/null || exit 1; }

rm -rf "${ADMIN_ROOT}.new"
mkdir -p "${ADMIN_ROOT}.new"
cp -a dist/. "${ADMIN_ROOT}.new/"

rm -rf "${ADMIN_ROOT}.bak"
mv "${ADMIN_ROOT}" "${ADMIN_ROOT}.bak"
mv "${ADMIN_ROOT}.new" "${ADMIN_ROOT}"
```

> **Neden guard var:** ilk denemede `ADMIN_ROOT` yerine `GERÇEK_KLASÖR`
> yazıldı. `mv` hata verdi ama önceki satırlar çalıştığı için
> `/www/raxen/velobet/GERÇEK_KLASÖR` adında çöp bir klasör oluştu.
> Varsa silin: `rm -rf /www/raxen/velobet/GERÇEK_KLASÖR*`

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

## Giriş çalışmıyor → önce HANGİ backend'in cevap verdiğine bakın

Bu sunucuda **birden fazla kumarhane projesi** var ve hepsi varsayılan olarak
**aynı 5000 portunu** kullanır:

| Dizin | Ne |
| --- | --- |
| `/www/raxen/velobet` | **bu proje** (backend + frontend + admin) |
| `/www/raxen/bizzocazino` | başka proje — pm2'de çalışan bu |
| `/www/wwwroot/bizzocazino2` | eskimiş kopya (Ağustos) |

nginx `apivelobet.com` alan adını `/www/raxen/velobet/backend`'e yönlendiriyor.
Ama `pm2 logs --nostream` **tüm** süreçler için tek bir log dosyası listeledi:
`bizzocazino2-backend` (fork mode, cwd `/www/raxen/bizzocazino/backend`).
Yani **bu projenin backend'i pm2'de hiç çalışmıyor.**

Bunun iki olası sonucu var ve ikisi farklı belirti verir:

- Port 5000'de kimse yoksa → giriş isteği **502/ağ hatası** alır.
- Port 5000'i **öteki proje** tutuyorsa → istek yanıtlanır ama **yanlış
  veritabanına** gider; hesaplar orada olmadığı için "kullanıcı bulunamadı"
  benzeri hata döner. Üyeliklerin giriş yapamaması tam olarak buna benzer.

### Teşhis (hiçbir şeyi değiştirmez)

```bash
pm2 list                                  # kaç süreç var, adları ne
ss -ltnp | grep -E ':(5000|3000)\b'       # 5000'i kim tutuyor (PID + komut)
grep -RA3 "apivelobet" /www/server/panel/vhost/nginx/ | grep proxy_pass
curl -s -o /dev/null -w '%{http_code}\n' https://apivelobet.com/health
```

`/health` **200** dönüyorsa bir backend var; **503** dönüyorsa süreç ayakta ama
veritabanı bağlı değil. Hangi projenin cevap verdiğini `ss` çıktısındaki PID'in
çalışma dizininden görürsünüz:

```bash
pwdx <PID>     # sürecin cwd'si: velobet mi, bizzocazino mu?
```

### Sunucudaki kopya eski — önce bunu düzeltin

30.08.2026'da ilk başlatma denemesi üç ayrı sorunu ortaya çıkardı:

```
[PM2][ERROR] Error: Script not found: /www/raxen/velobet/backend/app.js
[PM2][WARN]  Applications local-website-backend not running, starting...
ERR_PNPM_OUTDATED_LOCKFILE
```

Üçünün de anlamı ayrı:

**1. `app.js` aranıyor → sunucudaki checkout eski.** Depoda `script` alanı
`af2fda5` commit'inde `app.js` → `index.js` olarak düzeltildi (`app.js` diye
bir dosya hiç yok). Sunucu hâlâ `app.js` istediğine göre o commit orada değil.
Yani DB dayanıklılık düzeltmeleri de dahil hiçbir yeni commit çekilmemiş.

**2. Uygulama adı `local-website-backend` → `.env` eksik.** Ad
`<PROJECT_ID>-<WEBSITE_NAME>-backend` şablonundan üretilir. `.env` olsaydı
`local-Forcelab-backend` çıkardı; `website` görünmesi ikisinin de tanımsız
olduğu, yani **`.env` dosyasının hiç olmadığı** anlamına gelir. `.env` yoksa
`DATABASE_URI` de yoktur — backend başlasa bile veritabanına bağlanamaz.

**3. Lockfile uyuşmuyor.** Sunucudaki `package.json` içinde depoda olmayan
`@types/node ^26.4.0` ve `typescript ^7.0.2` var. Bunlar elle eklenmiş.

**4. `/www/raxen/velobet` bir git deposu DEĞİL.**

```
fatal: not a git repository (or any of the parent directories): .git
```

Klasör elle kopyalanmış. Bunun üç sonucu var: `git pull` ile güncelleme
yapılamaz, `git checkout` ile bozuk `package.json` geri alınamaz, ve
`.github/workflows/deploy.yml` otomatik dağıtımı da çalışamaz — çünkü o
workflow `DEPLOY_PATH`'in bir depo olmasını bekliyor.

### Kurtarma sırası

Önce yedek alın. Aşağıdaki adım takip eden dosyaları değiştirir:

```bash
cd /www/raxen
tar czf ~/velobet-yedek-$(date +%F-%H%M).tar.gz velobet
```

Klasörü yerinde gerçek bir depoya çevirin. Bu yol tercih edilir çünkü
`.env`, `backend/uploads/` ve `backend/config/` **izlenmeyen** dosyalardır;
`reset --hard` onlara dokunmaz, yani yüklemeler ve ayarlar yerinde kalır:

```bash
cd /www/raxen/velobet

git init
git remote add origin https://github.com/forcelabdevop/yenibfff.git
git fetch origin gamelaunch-integration --depth=1

# DİKKAT: bu, izlenen dosyalardaki yerel değişiklikleri siler
# (bozuk package.json dahil — zaten istediğimiz bu).
git reset --hard origin/gamelaunch-integration
```

> **Neden `main` değil:** DB dayanıklılık düzeltmeleri ve bu doküman
> `gamelaunch-integration` dalında; henüz `main`'e merge edilmedi. `main`'i
> çekerseniz eski kodu almış olursunuz. Merge ettikten sonra
> `git fetch origin main && git reset --hard origin/main` ile main'e
> geçebilirsiniz; otomatik dağıtım da o zaman devreye girer.

Doğrulayın — `app.js` hatasının kaynağı buydu:

```bash
grep -n 'script:' backend/ecosystem.config.js     # "index.js" olmalı
grep -cE '@types/node|typescript' backend/package.json   # 0 olmalı
```

Sonra `.env`:

```bash
cd backend
[ -f .env ] || cp .env.example .env
```

<details>
<summary>Alternatif: yerinde <code>git init</code> yerine temiz klasöre klonlama</summary>

Mevcut klasöre dokunmak istemiyorsanız yeni bir klona geçebilirsiniz. Bu
durumda **izlenmeyen dosyaları elle taşımanız şart** — aksi halde kullanıcı
yüklemeleri ve ayarlar kaybolur:

```bash
cd /www/raxen
git clone -b gamelaunch-integration \
  https://github.com/forcelabdevop/yenibfff.git velobet-yeni

# git'te OLMAYAN, taşınması zorunlu olanlar:
cp    velobet/backend/.env       velobet-yeni/backend/.env
cp -a velobet/backend/uploads/.  velobet-yeni/backend/uploads/   2>/dev/null
cp -a velobet/backend/config/.   velobet-yeni/backend/config/
[ -f velobet/deploy.env ] && cp velobet/deploy.env velobet-yeni/deploy.env
```

Sonra pm2 uygulamasını silip yeni yoldan başlatmanız ve nginx `root`
yollarını güncellemeniz gerekir. Bu yüzden yerinde `git init` daha az
hareketli parça içerir.

</details>

`.env` içinde en az şunlar dolu olmalı: `DATABASE_URI`, `WEBSITE_NAME`,
`PROJECT_ID`. **`.env.example` şablondur**; `DATABASE_URI` gerçek Atlas
bağlantı dizesiyle doldurulmadan backend çalışmaz.

`SERVER_PORT` `.env.example`'da **yok**; tanımlanmazsa kod `5000`'e düşer
(`index.js:253`). Bu sunucuda 5000 dolu olduğu için satırı elle eklemeniz
gerekir — aşağıya bakın.

```bash
# 5) Kurulum — lockfile artık package.json ile uyumlu
pnpm install --frozen-lockfile

# 6) Başlatın
pm2 start ecosystem.config.js --update-env
pm2 save
pm2 list
```

Doğru çalıştığında `pm2 list` **cluster modunda 4 instance** ve
`local-Forcelab-backend` benzeri bir ad göstermelidir — `bizzocazino2-backend`
gibi fork modunda tek süreç değil.

> **Kod değişti:** `reset --hard` frontend ve admin kaynaklarını da
> güncelledi. Eski derlemeler yayında kalmasın diye **Adım 3 (frontend) ve
> Adım 4 (admin)** build+yayın işlemlerini tekrarlayın.

> **`--frozen-lockfile` hata verirse durun.** `--no-frozen-lockfile` ile
> geçiştirmeyin: bu, lockfile'ı sunucuda sessizce değiştirip depodakinden
> farklı sürümler kurar ve sunucuyu bir daha tekrarlanamaz hale getirir.
> Hata devam ediyorsa `git status` ile `backend/package.json`'ın gerçekten
> temiz olduğunu doğrulayın.

### Port 5000'i Node değil, başka bir şey tutuyor

`ss` çıktısı şunu gösterdi:

```
LISTEN *:5000  users:(("MainThread",pid=1297003,...))
```

Bu **pm2'deki süreç değil** (o `pid=1292634`). `MainThread` süreç adı
tipik olarak bir Python uygulamasına işaret eder. Yani `apivelobet.com`
üzerinden gelen istekler bu projenin backend'ine değil, **tamamen başka bir
uygulamaya** gidiyor. Üyeliklerin giriş yapamamasının en olası açıklaması bu.

Kimin tuttuğunu kesinleştirin:

```bash
pwdx 1297003                    # çalışma dizini
ls -l /proc/1297003/exe         # gerçek çalıştırılabilir (python? node?)
systemctl status $(systemctl list-units --type=service --state=running \
  --no-legend | awk '{print $1}' | head -50) 2>/dev/null | grep -B5 1297003
```

Bu süreç başka bir sitenin canlı API'siyse **durdurmayın**. Bunun yerine bu
projeyi farklı bir porta alın:

```bash
# backend/.env
SERVER_PORT=5001
```

Sonra nginx'te `apivelobet.com` sunucu bloğundaki `proxy_pass` hedefini
`127.0.0.1:5001` yapın ve:

```bash
nginx -t && systemctl reload nginx
curl -s -o /dev/null -w '%{http_code}\n' https://apivelobet.com/health
```

`200` bekliyoruz. `503` gelirse süreç ayakta ama `DATABASE_URI` yanlış.

## Sorun giderme

| Belirti | Sebep |
| --- | --- |
| Giriş çalışmıyor / üyelik bulunamıyor | Yanlış backend cevap veriyor (üstteki bölüm) |
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
