ipto #!/usr/bin/env bash
#
# Forcelab — sunucu tarafi otomatik dagitim
# ==========================================
#
# main dalina merge edilince sunucuyu guncelleyen script. aaPanel Webhook
# eklentisi, GitHub Actions (SSH) veya elle calistirilabilir.
#
# TASARIM ILKELERI (casino = para tutan sistem, bunlar pazarlik konusu degil):
#   1. ATOMIK       — frontend yarim yayinlanmaz; build bitince takas edilir.
#   2. GERI ALINIR  — saglik kontrolu gecmezse ONCEKI surume otomatik doner.
#   3. TEK CALISMA  — flock ile es zamanli iki dagitim engellenir.
#   4. SIFIR KESINTI— pm2 reload (restart DEGIL) ile cluster sirayla yenilenir.
#   5. GOC YOK      — migration/seed KASITLI olarak calistirilmaz (elle).
#
# KULLANIM
#   bash scripts/deploy.sh              # normal dagitim
#   bash scripts/deploy.sh --force      # degisiklik olmasa da yeniden kur
#   bash scripts/deploy.sh --dry-run    # ne yapacagini goster, dokunma
#
# AYAR
#   Repo kokunde `deploy.env` olusturun (git'e girmez):
#     WEB_ROOT=/www/wwwroot/velobet285.com
#     BRANCH=main
#     SERVER_PORT=5000
#     PM2_APP_NAME=velobet-backend
#     EVM_HD_MNEMONIC="... 12/15/18/21/24 kelime ..."
#     TRON_HD_MNEMONIC="... 12/15/18/21/24 kelime ..."
#     PNPM_BIN=/www/server/nodejs/v20.x.x/bin/pnpm
#   deploy.env chmod 600 olmali ve ASLA git'e eklenmemelidir.
#
set -euo pipefail

# ---------------------------------------------------------------------------
# Yol tespiti — script nerede olursa olsun repo kokunu bulur
# ---------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${REPO_DIR}"

# ---------------------------------------------------------------------------
# Ayarlari yukle
# ---------------------------------------------------------------------------
if [[ -f "${REPO_DIR}/deploy.env" ]]; then
	# shellcheck disable=SC1091
	set -a; source "${REPO_DIR}/deploy.env"; set +a
fi

BRANCH="${BRANCH:-main}"
WEB_ROOT="${WEB_ROOT:-}"
SERVER_PORT="${SERVER_PORT:-5000}"
# GERCEK, calisan pm2 process adi (ornek: bizzocazino2-back). Bos birakilirsa
# ecosystem.config.js'nin hesapladigi ada (PROJECT_ID/WEBSITE_NAME env'lerine
# bagli) reload atilir — bu ad gercek process ile ESLESMEZSE pm2 mevcut
# process'i reload etmek yerine YENI, YEDEK bir process kumesi baslatir
# (ayni SERVER_PORT'u dinlemeye calisan cift process = canliyi bozma riski).
PM2_APP_NAME="${PM2_APP_NAME:-}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:${SERVER_PORT}/health}"
# Para kabul eden production backend eksik bir HD seed ile yayinlanmamali.
# Degerin kendisini asla loglamadan yalnizca varligini ve BIP39 kelime sayisini
# deploy oncesinde dogrulariz.
REQUIRE_CRYPTO_WALLETS="${REQUIRE_CRYPTO_WALLETS:-1}"
HEALTH_RETRIES="${HEALTH_RETRIES:-15}"
HEALTH_DELAY="${HEALTH_DELAY:-2}"
LOG_FILE="${LOG_FILE:-${REPO_DIR}/logs/deploy.log}"

FORCE=0
DRY_RUN=0
for arg in "$@"; do
	case "$arg" in
		--force)   FORCE=1 ;;
		--dry-run) DRY_RUN=1 ;;
		*) echo "Bilinmeyen parametre: $arg" >&2; exit 2 ;;
	esac
done

mkdir -p "$(dirname "${LOG_FILE}")"

log() { printf '[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*" | tee -a "${LOG_FILE}"; }

# die() — olumcul hata.
#
# ONEMLI: Buradaki `exit 1` ERR trap'ini TETIKLEMEZ (bash `exit`'i hata
# saymaz). Bu yuzden geri alma noktasindan sonra die() cagrilirsa rollback'i
# ACIKCA calistirmamiz gerekir; aksi halde kod yeni surumde, frontend eski
# surumde kalir — yani KARISIK ve bozuk bir durum olusur.
# ROLLBACK_ARMED, "kodu cektik" adimindan sonra 1 yapilir.
ROLLBACK_ARMED=0
die() {
	log "HATA: $*"
	if [[ ${ROLLBACK_ARMED} -eq 1 ]]; then rollback; fi
	exit 1
}
run() {
	if [[ ${DRY_RUN} -eq 1 ]]; then log "DRY-RUN: $*"; else "$@"; fi
}

validate_mnemonic_env() {
	local name="$1" value="${!1:-}" words
	[[ -n "${value//[[:space:]]/}" ]] || die "${name} deploy.env icinde tanimli degil. Kripto yatirma guvenli sekilde baslatilamaz."
	words="$(wc -w <<<"${value}" | tr -d ' ')"
	case "${words}" in
		12|15|18|21|24) ;;
		*) die "${name} gecersiz BIP39 kelime sayisina sahip (${words}). Degerin kendisi loglanmadi." ;;
	esac
}

if [[ "${REQUIRE_CRYPTO_WALLETS}" == "1" ]]; then
	validate_mnemonic_env EVM_HD_MNEMONIC
	validate_mnemonic_env TRON_HD_MNEMONIC
fi

# ---------------------------------------------------------------------------
# Tek calisma kilidi
#
# aaPanel webhook'u arka arkaya iki push'ta iki kez tetiklenebilir. Ikisi ayni
# anda build alirsa yarim dosya yayinlanir. flock bunu engeller.
# ---------------------------------------------------------------------------
LOCK_FILE="/tmp/forcelab-deploy.lock"
exec 9>"${LOCK_FILE}"
if ! flock -n 9; then
	log "Baska bir dagitim suruyor, cikiliyor."
	exit 0
fi

log "═══ Dagitim basladi (dal: ${BRANCH}) ═══"

# ---------------------------------------------------------------------------
# Arac tespiti — aaPanel webhook'unda PATH cogu zaman eksiktir
# ---------------------------------------------------------------------------
find_bin() {
	local name="$1" override="$2"
	if [[ -n "${override}" && -x "${override}" ]]; then echo "${override}"; return 0; fi
	if command -v "${name}" >/dev/null 2>&1; then command -v "${name}"; return 0; fi
	# aaPanel node kurulumlari genelde buraya duser
	local found
	found="$(ls -1 /www/server/nodejs/*/bin/"${name}" 2>/dev/null | tail -1 || true)"
	[[ -n "${found}" ]] && { echo "${found}"; return 0; }
	return 1
}

PNPM="$(find_bin pnpm "${PNPM_BIN:-}")" || die "pnpm bulunamadi. deploy.env icine PNPM_BIN=... yazin."
PM2="$(find_bin pm2 "${PM2_BIN:-}")"    || die "pm2 bulunamadi. deploy.env icine PM2_BIN=... yazin."
NODE_BIN_DIR="$(dirname "${PNPM}")"
export PATH="${NODE_BIN_DIR}:${PATH}"

log "pnpm : ${PNPM}"
log "pm2  : ${PM2}"

# ---------------------------------------------------------------------------
# Degisiklik var mi?
# ---------------------------------------------------------------------------
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || die "${REPO_DIR} bir git deposu degil."

# Build her calistiginda bu dosyalari yeniden uretir (admin icon bundling +
# casino-ui tailwind derlemesi). Elle yapilmis degisiklikler degil, guvenle
# atilabilir — aksi halde her `pnpm run build` sonrasi repo "dirty" kalir ve
# BIR SONRAKI deploy.sh calismasi "commit edilmemis degisiklik var" hatasiyla
# durur (build basarili olsa bile).
GENERATED_FILES=(
	"admin/src/@iconify/icons-bundle.js"
	"frontend/public/casino-ui/tailwind.css"
)
for f in "${GENERATED_FILES[@]}"; do
	if [[ -f "${REPO_DIR}/${f}" ]]; then
		run git checkout --quiet -- "${f}" || true
	fi
done

# Yerelde elle yapilmis degisiklik varsa DURDUR. Sessizce ezmek, sunucuda
# yapilmis acil bir duzeltmeyi yok etmek demektir.
if [[ -n "$(git status --porcelain --untracked-files=no)" ]]; then
	die "Sunucuda commit edilmemis degisiklik var. Once onlari halledin (git status)."
fi

PREV_COMMIT="$(git rev-parse HEAD)"
run git fetch --quiet origin "${BRANCH}"
NEW_COMMIT="$(git rev-parse "origin/${BRANCH}")"

log "mevcut : ${PREV_COMMIT:0:8}"
log "hedef  : ${NEW_COMMIT:0:8}"

if [[ "${PREV_COMMIT}" == "${NEW_COMMIT}" && ${FORCE} -eq 0 ]]; then
	log "Degisiklik yok. Cikiliyor. (--force ile zorlayabilirsiniz)"
	exit 0
fi

# ---------------------------------------------------------------------------
# Goc uyarisi — otomatik CALISTIRILMAZ (bilincli tercih)
# ---------------------------------------------------------------------------
if [[ "${PREV_COMMIT}" != "${NEW_COMMIT}" ]]; then
	CHANGED="$(git diff --name-only "${PREV_COMMIT}" "${NEW_COMMIT}" || true)"
	if grep -qE "(migration|seed|schema)" <<<"${CHANGED}"; then
		log "⚠  DIKKAT: Bu surumde migration/seed dosyalari degismis."
		log "⚠  Bunlar OTOMATIK CALISTIRILMAZ. Dagitimdan sonra elle calistirin."
	fi
fi

# ---------------------------------------------------------------------------
# Geri alma
# ---------------------------------------------------------------------------
ROLLED_BACK=0
rollback() {
	[[ ${ROLLED_BACK} -eq 1 ]] && return 0
	ROLLED_BACK=1
	log "↩  GERI ALINIYOR → ${PREV_COMMIT:0:8}"
	git reset --hard --quiet "${PREV_COMMIT}" || log "git reset basarisiz!"
	# Frontend'i yedekten geri koy (build almaktan cok daha hizli)
	if [[ -n "${WEB_ROOT}" && -d "${WEB_ROOT}.bak" ]]; then
		rm -rf "${WEB_ROOT}.failed" 2>/dev/null || true
		mv "${WEB_ROOT}" "${WEB_ROOT}.failed" 2>/dev/null || true
		mv "${WEB_ROOT}.bak" "${WEB_ROOT}" 2>/dev/null || log "frontend geri alinamadi!"
	fi
	( cd "${REPO_DIR}/backend" && "${PNPM}" install --prod --frozen-lockfile ) || true
	if [[ -n "${PM2_APP_NAME}" ]]; then
		( cd "${REPO_DIR}/backend" && "${PM2}" reload "${PM2_APP_NAME}" --update-env ) || true
	else
		( cd "${REPO_DIR}/backend" && "${PM2}" reload ecosystem.config.js --update-env ) || true
	fi
	log "↩  Geri alma tamamlandi. Loglari inceleyin: ${LOG_FILE}"
}

# ---------------------------------------------------------------------------
# Kodu cek
# ---------------------------------------------------------------------------
log "→ Kod cekiliyor"
run git reset --hard --quiet "origin/${BRANCH}"

# Bu noktadan SONRA olusan her hata geri almayi tetikler.
# ERR trap komut hatalarini, ROLLBACK_ARMED ise die() cagrilarini yakalar.
trap 'rollback; exit 1' ERR
ROLLBACK_ARMED=1

# ---------------------------------------------------------------------------
# Backend bagimliliklari
# ---------------------------------------------------------------------------
log "→ Backend bagimliliklari"
run bash -c "cd '${REPO_DIR}/backend' && '${PNPM}' install --prod --frozen-lockfile"

# ---------------------------------------------------------------------------
# Frontend derleme + atomik yayin
#
# Build ONCE tamamlanir, ANCAK sonra canliya takas edilir. Boylece build
# suresince (dakikalarca) site eski haliyle calismaya devam eder.
# ---------------------------------------------------------------------------
log "→ Frontend bagimliliklari"
run bash -c "cd '${REPO_DIR}/frontend' && '${PNPM}' install --frozen-lockfile"

log "→ Frontend derleniyor (birkac dakika surebilir)"
run bash -c "cd '${REPO_DIR}/frontend' && '${PNPM}' run build"

if [[ ${DRY_RUN} -eq 0 && ! -f "${REPO_DIR}/frontend/out/index.html" ]]; then
	die "Build cikti uretmedi (frontend/out/index.html yok)."
fi

if [[ -n "${WEB_ROOT}" ]]; then
	log "→ Yayinlaniyor: ${WEB_ROOT}"
	if [[ ${DRY_RUN} -eq 0 ]]; then
		rm -rf "${WEB_ROOT}.new"
		mkdir -p "${WEB_ROOT}.new"
		cp -a "${REPO_DIR}/frontend/out/." "${WEB_ROOT}.new/"
		rm -rf "${WEB_ROOT}.bak"
		[[ -d "${WEB_ROOT}" ]] && mv "${WEB_ROOT}" "${WEB_ROOT}.bak"
		mv "${WEB_ROOT}.new" "${WEB_ROOT}"
		log "   yedek: ${WEB_ROOT}.bak"
	else
		log "DRY-RUN: ${WEB_ROOT} guncellenecekti"
	fi
else
	log "⚠  WEB_ROOT tanimsiz — frontend yalnizca derlendi, yayinlanmadi."
	log "⚠  deploy.env icine WEB_ROOT=/www/wwwroot/<site> ekleyin."
fi

# ---------------------------------------------------------------------------
# Backend yeniden yukle (sifir kesinti)
# ---------------------------------------------------------------------------
log "→ Backend yeniden yukleniyor (pm2 reload)"
export GIT_COMMIT="${NEW_COMMIT:0:8}"
if [[ -n "${PM2_APP_NAME}" ]]; then
	if ! "${PM2}" describe "${PM2_APP_NAME}" >/dev/null 2>&1; then
		die "PM2_APP_NAME='${PM2_APP_NAME}' pm2'de bulunamadi (pm2 list ile kontrol edin). Yeni bir process baslatmamak icin durduruldu."
	fi
	log "   hedef process: ${PM2_APP_NAME}"
	run bash -c "cd '${REPO_DIR}/backend' && GIT_COMMIT='${NEW_COMMIT:0:8}' '${PM2}' reload '${PM2_APP_NAME}' --update-env"
else
	log "⚠  PM2_APP_NAME tanimsiz — ecosystem.config.js'nin hesapladigi ada gore reload denenecek."
	log "⚠  Bu ad gercek process ile eslesmezse pm2 YENI bir process baslatir (port cakismasi riski)."
	log "⚠  deploy.env icine PM2_APP_NAME=<pm2 list'teki gercek ad> ekleyin."
	run bash -c "cd '${REPO_DIR}/backend' && GIT_COMMIT='${NEW_COMMIT:0:8}' '${PM2}' reload ecosystem.config.js --update-env"
fi

# ---------------------------------------------------------------------------
# Saglik kontrolu — gecmezse otomatik geri alinir
# ---------------------------------------------------------------------------
if [[ ${DRY_RUN} -eq 0 ]]; then
	log "→ Saglik kontrolu: ${HEALTH_URL}"
	healthy=0
	for i in $(seq 1 "${HEALTH_RETRIES}"); do
		code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "${HEALTH_URL}" || echo 000)"
		if [[ "${code}" == "200" ]]; then
			healthy=1
			log "   ✓ saglikli (${i}. deneme)"
			break
		fi
		log "   ... HTTP ${code} (${i}/${HEALTH_RETRIES})"
		sleep "${HEALTH_DELAY}"
	done
	[[ ${healthy} -eq 1 ]] || die "Saglik kontrolu basarisiz — geri aliniyor."
fi

trap - ERR
ROLLBACK_ARMED=0   # basarili: bundan sonraki hicbir sey geri almayi tetiklemesin
log "��� Dagitim tamamlandi → ${NEW_COMMIT:0:8}"
log "═══════════════════════════════════════"
