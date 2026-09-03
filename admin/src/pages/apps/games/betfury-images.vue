<script setup>
import { ref, computed } from "vue";
import { VDataTable } from "vuetify/labs/VDataTable";
import axios from "@axios";
import ability from "@/plugins/casl/ability";

const canManageGames = computed(
	() => ability.can("update", "games") || ability.can("manage", "games"),
);

const loading = ref(false);
const applying = ref(false);
const errorMessage = ref("");
const applyResult = ref(null);

const onlyMissingBanner = ref(true);
const lockAfterApply = ref(true);
const search = ref("");

const matches = ref([]);
const catalogueCount = ref(0);
const ourGameCount = ref(0);
const selected = ref([]); // seçili gameId listesi

const filteredMatches = computed(() => {
	const q = search.value.trim().toLowerCase();
	if (!q) return matches.value;
	return matches.value.filter(
		(m) =>
			m.gameName?.toLowerCase().includes(q) ||
			m.gameCode?.toLowerCase().includes(q) ||
			m.providerCode?.toLowerCase().includes(q),
	);
});

const exactCount = computed(
	() => matches.value.filter((m) => m.matchType === "exact").length,
);

const headers = [
	{ title: "Mevcut Görsel", key: "currentBanner", sortable: false },
	{ title: "BetFury Adayı", key: "previewUrl", sortable: false },
	{ title: "Oyun", key: "gameName" },
	{ title: "Sağlayıcı", key: "providerCode" },
	{ title: "Eşleşme", key: "matchType", sortable: false },
];

const loadMatches = async (force = false) => {
	loading.value = true;
	errorMessage.value = "";
	applyResult.value = null;
	selected.value = [];
	try {
		const { data } = await axios.get("/admin/game-import/betfury/matches", {
			params: { onlyMissingBanner: onlyMissingBanner.value, force },
		});
		matches.value = data.data?.matches || [];
		catalogueCount.value = data.data?.catalogueCount || 0;
		ourGameCount.value = data.data?.ourGameCount || 0;
	} catch (error) {
		errorMessage.value = error.response?.data?.message || error.message;
	} finally {
		loading.value = false;
	}
};

const selectAllExact = () => {
	selected.value = matches.value
		.filter((m) => m.matchType === "exact")
		.map((m) => m.gameId);
};

const clearSelection = () => {
	selected.value = [];
};

const applySelected = async () => {
	if (!selected.value.length) return;
	applying.value = true;
	applyResult.value = null;
	errorMessage.value = "";
	try {
		const selections = matches.value
			.filter((m) => selected.value.includes(m.gameId))
			.map((m) => ({ gameId: m.gameId, imageId: m.imageId }));

		const { data } = await axios.post("/admin/game-import/betfury/apply", {
			selections,
			lockAfterApply: lockAfterApply.value,
		});
		applyResult.value = data.data;

		// Uygulanan oyunları listeden çıkar (tekrar seçilip yanlışlıkla
		// ikinci kez uygulanmasın).
		const appliedIds = new Set(selections.map((s) => s.gameId));
		matches.value = matches.value.filter((m) => !appliedIds.has(m.gameId));
		selected.value = [];
	} catch (error) {
		errorMessage.value = error.response?.data?.message || error.message;
	} finally {
		applying.value = false;
	}
};
</script>

<route lang="yaml">
meta:
  action: read
  subject: games
</route>

<template>
	<div>
		<div class="mb-4 d-flex align-center justify-space-between flex-wrap gap-2">
			<div>
				<h4 class="text-h4 mb-1">BetFury Görselleri</h4>
				<p class="text-body-2 text-medium-emphasis mb-0">
					BetFury'nin herkese açık oyun kataloğundan, isim eşleşmesiyle
					oyunlarımıza kaliteli kapak görseli önerir. Hiçbir görsel admin
					onayı olmadan uygulanmaz.
				</p>
			</div>
			<RouterLink :to="{ name: 'apps-games-import' }">
				<VBtn variant="tonal" prepend-icon="tabler-arrow-left">
					Oyun İçe Aktarma'ya Dön
				</VBtn>
			</RouterLink>
		</div>

		<VAlert type="info" variant="tonal" class="mb-4">
			BetFury bir oyun sağlayıcısı olarak eklenmez — burada yeni oyun kaydı
			oluşturulmaz, sadece <strong>var olan</strong> oyunlarınızın görseli için
			aday sunulur. <strong>Kilitli</strong> oyunlar (Oyun Yönetimi'nde
			"Görseli/İsmi İçe Aktarımdan Koru" açık olanlar) bu listeye hiç
			girmez — asla değiştirilemezler. Uyguladığınız görsel, varsayılan
			olarak otomatik kilitlenir; böylece sonraki bir sağlayıcı
			senkronizasyonu bu görseli ezmez.
		</VAlert>

		<VCard class="mb-4">
			<VCardText>
				<VRow align="center">
					<VCol cols="12" md="4">
						<VSwitch
							v-model="onlyMissingBanner"
							color="primary"
							density="compact"
							label="Sadece görseli boş/eksik olan oyunları göster"
							hide-details
						/>
					</VCol>
					<VCol cols="12" md="4">
						<VSwitch
							v-model="lockAfterApply"
							color="warning"
							density="compact"
							label="Uygulanan görseli otomatik kilitle"
							hide-details
						/>
					</VCol>
					<VCol cols="12" md="4" class="text-md-right">
						<VBtn
							color="primary"
							:loading="loading"
							prepend-icon="tabler-cloud-download"
							@click="loadMatches(false)"
						>
							Eşleşmeleri Getir
						</VBtn>
					</VCol>
				</VRow>
			</VCardText>
		</VCard>

		<VAlert v-if="errorMessage" type="error" variant="tonal" class="mb-4">
			{{ errorMessage }}
		</VAlert>

		<VAlert
			v-if="applyResult"
			type="success"
			variant="tonal"
			class="mb-4"
		>
			Uygulandı: {{ applyResult.updated }} · Kilitli olduğu için atlanan:
			{{ applyResult.skipped_locked }} · Bulunamayan:
			{{ applyResult.not_found }} · Hata: {{ applyResult.errors?.length || 0 }}
		</VAlert>

		<VCard v-if="matches.length || loading">
			<VCardText class="d-flex align-center flex-wrap gap-4">
				<div class="text-body-2 text-medium-emphasis">
					BetFury kataloğu: <strong>{{ catalogueCount }}</strong> oyun ·
					Bizim oyunlarımız: <strong>{{ ourGameCount }}</strong> ·
					Bulunan eşleşme: <strong>{{ matches.length }}</strong> ·
					Tam eşleşen (kilitsiz): <strong>{{ exactCount }}</strong>
				</div>
				<VSpacer />
				<VTextField
					v-model="search"
					density="compact"
					placeholder="Oyun / kod / sağlayıcı ara"
					prepend-inner-icon="tabler-search"
					style="max-width: 260px"
					hide-details
				/>
			</VCardText>

			<VCardText class="d-flex align-center gap-2 flex-wrap">
				<VBtn size="small" variant="tonal" @click="selectAllExact">
					Tam Eşleşenleri Seç ({{ exactCount }})
				</VBtn>
				<VBtn size="small" variant="text" @click="clearSelection">
					Seçimi Temizle
				</VBtn>
				<VSpacer />
				<VBtn
					v-if="canManageGames"
					color="success"
					:disabled="!selected.length"
					:loading="applying"
					prepend-icon="tabler-check"
					@click="applySelected"
				>
					Seçilenleri Uygula ({{ selected.length }})
				</VBtn>
			</VCardText>

			<VDataTable
				v-model="selected"
				:headers="headers"
				:items="filteredMatches"
				item-value="gameId"
				show-select
				:loading="loading"
				:items-per-page="25"
				select-strategy="page"
			>
				<template #item.currentBanner="{ item }">
					<VAvatar rounded size="48" v-if="item.raw.currentBanner">
						<VImg :src="item.raw.currentBanner" cover />
					</VAvatar>
					<span v-else class="text-caption text-medium-emphasis">Yok</span>
				</template>

				<template #item.previewUrl="{ item }">
					<VAvatar rounded size="48">
						<VImg :src="item.raw.previewUrl" cover />
					</VAvatar>
				</template>

				<template #item.gameName="{ item }">
					<div class="font-weight-medium">{{ item.raw.gameName }}</div>
					<div class="text-caption text-medium-emphasis">
						{{ item.raw.gameCode }} · BetFury: {{ item.raw.betfuryName }}
					</div>
				</template>

				<template #item.providerCode="{ item }">
					{{ item.raw.providerCode || "—" }}
				</template>

				<template #item.matchType="{ item }">
					<VChip
						size="small"
						:color="item.raw.matchType === 'exact' ? 'success' : 'warning'"
						variant="tonal"
					>
						{{
							item.raw.matchType === "exact"
								? "Tam Eşleşme"
								: `Belirsiz (${item.raw.candidateCount})`
						}}
					</VChip>
				</template>
			</VDataTable>
		</VCard>
	</div>
</template>
