# Game Launch — Çok Sağlayıcılı Örnek

Bu klasör, bir casino/bahis sitesinde **"oyuna tıkla → oyun açılsın"** akışının arkasındaki
mimariyi gösteren **bağımsız, sadeleştirilmiş** bir örnektir. Gerçek prod projeden
kopyalanmamıştır; gerçek iş mantığı (bonus/çevrim şartı, misyon sistemi, gerçek
MongoDB modelleri, gerçek API anahtarları) çıkarılmış, sadece **"oyun başlatma"
sırasında her sağlayıcı entegrasyonunda tekrar eden kalıp** bırakılmıştır.

## Neden bu şekilde kurulu?

Bir casino sitesi genelde **birden fazla oyun sağlayıcısı** ile çalışır (Pragmatic Play,
Evolution, canlı casino, poker, spor bahisleri vb. sağlayıcılar üzerinden). Her
sağlayıcının "oyunu başlat / bana bir launch URL ver" isteği **farklı bir şekilde**
çalışır:

| Sağlayıcı  | Kimlik doğrulama                          | İstek şekli                  | Yanıt                     |
|------------|--------------------------------------------|-------------------------------|----------------------------|
| Betinovi   | Her istekte `agentCode` + `token` (body)   | POST, tek endpoint, `method` alanı | `{ status, launchUrl }`     |
| Nexus      | Her istekte `agent_code` + `agent_token`   | POST, tek endpoint, `method` alanı | `{ status, launch_url }`    |
| Drakon     | OAuth: önce `client_id/secret` → Bearer     | GET + query params, `Authorization: Bearer` | `{ game_url }`               |
| Poker      | Basic auth ile token al → Bearer            | POST + `Authorization: Bearer` | `{ game_url }`               |
| Betcolabs  | Session token (bizim ürettiğimiz)           | Biz kendimiz query-string URL kuruyoruz | Sağlayıcıdan gelen `session_token` |

Yani "tek bir launch fonksiyonu her sağlayıcı için çalışır" diye bir şey **yok** —
her sağlayıcı kendi adaptörünü ister. Bu örnek, bu farklılığı gizlemeden, ama
tekrar eden kısmı (kullanıcı kontrolü, bakiye kontrolü, hata yönetimi) **paylaşılan
bir katmana** çıkararak nasıl düzenli tutulacağını gösterir.

## Mimari

```
public/                     Basit bir frontend: oyun kartları + iframe modal
  index.html
  app.js                    Karta tıkla -> POST /api/games/launch -> iframe'de aç

server.js                   Express uygulamasını kurar, statik dosyaları ve
                             /api/games rotasını bağlar

src/
  routes/launch.js          TEK bir provider-agnostic endpoint: POST /api/games/launch
                             Frontend hangi sağlayıcının nasıl çalıştığını bilmez;
                             sadece { userId, provider, gameCode } gönderir.

  providers/
    index.js                Registry: provider adı -> adapter eşlemesi.
                             Yeni bir sağlayıcı eklemek = buraya bir satır eklemek.
    betinovi.js              Her adapter AYNI sözleşmeyi uygular:
    drakon.js                 launchGame(user, params) -> { launchUrl, provider }
    nexus.js                 ama İÇERİDE saglayıcıya özgü kimlik doğrulama/istek
    poker.js                 şeklini uygular (yukarıdaki tablo).
    betcolabs.js

  services/
    launchGuards.js          Her sağlayıcıdan ÖNCE çalışan paylaşılan kontroller:
                             kullanıcı var mı, bahis erişimi engelli mi, aktif
                             cüzdanı var mı, bakiyesi üst sınırı aşıyor mu.
    userStore.js             Bellek-içi sahte kullanıcı deposu (gerçek projede
                             MongoDB User modeli + Wallet alt-belgeleri).

  utils/httpClient.js        Tüm sağlayıcı çağrılarının geçtiği tek nokta:
                             timeout + tutarlı hata loglama.
```

## Nasıl çalıştırılır?

```bash
cd game-launch-example
npm install
cp .env.example .env   # İsteğe bağlı: kendi test sağlayıcı URL'lerinizi girin
npm start
```

Tarayıcıda `http://localhost:4000` açın. `.env` doldurulmadan da çalışır —
sağlayıcı çağrıları gerçek bir API'ye gitmeye çalışacağı için hata dönecektir
(bu beklenen bir durumdur; amaç akışı ve hata yönetimini göstermektir). Gerçek
bir sağlayıcı sandbox/test ortamınız varsa `.env` içine o bilgileri girip
gerçek bir launch URL alabilirsiniz.

## Gerçek projeye göre neler basitleştirildi?

- **Veritabanı yok** — `userStore.js` bellek-içi bir `Map`. Gerçekte MongoDB.
- **Callback/webhook akışı yok** — sağlayıcının bahis sırasında bize geri
  bildirim gönderip bakiye düşme/yatırma işlemini gerçek zamanlı yaptığı
  (`POST /callback/betinovi` gibi) uçlar bu örnekte yok; sadece "oyunu aç" adımı var.
- **Bonus/çevrim şartı, misyon sistemi, RTP override gibi iş mantığı yok** —
  gerçek projede `game_launch` öncesi bu kontroller de araya girer.
- **Gerçek API anahtarları yok** — `.env.example` sadece örnek/sahte değerler
  içerir. Gerçek bir entegrasyon için sağlayıcının size verdiği agent
  code/token'ları kendi `.env` dosyanıza (asla koda gömülü olarak değil) eklemeniz gerekir.

## Yeni bir sağlayıcı eklemek istersen

1. `src/providers/yeni-saglayici.js` oluştur, `launchGame(user, params)` fonksiyonunu
   yaz — sağlayıcının kendi kimlik doğrulama/istek şeklini uygula.
2. `src/providers/index.js` içindeki `PROVIDERS` nesnesine bir satır ekle.
3. Frontend'de `DEMO_GAMES` listesine `provider: "yeni-saglayici"` ile bir kart ekle.

`routes/launch.js` veya `launchGuards.js`'e dokunmana gerek kalmaz — paylaşılan
kontroller ve genel akış otomatik olarak yeni sağlayıcı için de çalışır.
