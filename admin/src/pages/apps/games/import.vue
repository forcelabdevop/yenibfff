<script setup>
import { ref, computed, onMounted } from "vue";
import axios from "@axios";
import ability from "@/plugins/casl/ability";

const canManageGames = computed(
	() => ability.can("update", "games") || ability.can("manage", "games"),
);

// -------------------- Ortak sonuç paneli --------------------

const lastResult = ref(null); // { provider, data: {created, images_updated, metadata_only, skipped_locked, errors}, error }

const resultSummary = computed(() => {
	if (!lastResult.value?.data) return null;
	const d = lastResult.value.data;
	return [
		{ label: "Yeni Eklenen", value: d.created || 0, color: "success" },
		{ label: "Görsel Güncellenen", value: d.images_updated || 0, color: "info" },
		{ label: "Sadece Bilgi Güncellenen", value: d.metadata_only || 0, color: "secondary" },
		{ label: "Korunan (Kilitli Görsel)", value: d.skipped_locked || 0, color: "warning" },
		{ label: "Hata", value: d.errors?.length || 0, color: "error" },
	];
});

// -------------------- Betinovi --------------------

const betinoviVendors = ref([]);
const betinoviVendorsLoading = ref(false);
const betinoviSelectedVendor = ref("all");
const betinoviForceImages = ref(false);
const betinoviImporting = ref(false);

const betinoviVendorOptions = computed(() => [
	{ title: "Tüm Vendorlar (Hepsini İçe Aktar)", value: "all" },
	...betinoviVendors.value.map((v) => ({
		title: `${v.vendorName || v.vendorCode} (${v.vendorCode})`,
		value: v.vendorCode,
	})),
]);

const loadBetinoviVendors = async () => {
	betinoviVendorsLoading.value = true;
	try {
		const { data } = await axios.get("/admin/game-import/betinovi/vendors");
		betinoviVendors.value = data.data || [];
	} catch (error) {
		console.error("Betinovi vendor listesi alınamadı:", error);
	} finally {
		betinoviVendorsLoading.value = false;
	}
};

const importBetinovi = async () => {
	betinoviImporting.value = true;
	lastResult.value = null;
	try {
		const { data } = await axios.post("/admin/game-import/betinovi", {
			vendorCode: betinoviSelectedVendor.value,
			forceUpdateImages: betinoviForceImages.value,
		});
		lastResult.value = { provider: "Betinovi", data: data.data };
	} catch (error) {
		lastResult.value = {
			provider: "Betinovi",
			error: error.response?.data?.message || error.message,
		};
	} finally {
		betinoviImporting.value = false;
	}
};

// -------------------- Nexus --------------------

const nexusProviders = ref([]);
const nexusProvidersLoading = ref(false);
const nexusSelectedProvider = ref("all");
const nexusForceImages = ref(false);
const nexusImporting = ref(false);

const nexusProviderOptions = computed(() => [
	{ title: "Tüm Sağlayıcılar (Hepsini İçe Aktar)", value: "all" },
	...nexusProviders.value.map((p) => {
		const code = p.provider_code || p.code;
		return { title: `${p.provider_name || p.name || code} (${code})`, value: code };
	}),
]);

const loadNexusProviders = async () => {
	nexusProvidersLoading.value = true;
	try {
		const { data } = await axios.get("/admin/game-import/nexus/providers");
		nexusProviders.value = data.data || [];
	} catch (error) {
		console.error("Nexus sağlayıcı listesi alınamadı:", error);
	} finally {
		nexusProvidersLoading.value = false;
	}
};

const importNexus = async () => {
	nexusImporting.value = true;
	lastResult.value = null;
	try {
		const { data } = await axios.post("/admin/game-import/nexus", {
			providerCode: nexusSelectedProvider.value,
			forceUpdateImages: nexusForceImages.value,
		});
		lastResult.value = { provider: "Nexus", data: data.data };
	} catch (error) {
		lastResult.value = {
			provider: "Nexus",
			error: error.response?.data?.message || error.message,
		};
	} finally {
		nexusImporting.value = false;
	}
};

// -------------------- Drakon --------------------

const drakonForceImages = ref(false);
const drakonImporting = ref(false);

const importDrakon = async () => {
	drakonImporting.value = true;
	lastResult.value = null;
	try {
		const { data } = await axios.post("/admin/game-import/drakon", {
			forceUpdateImages: drakonForceImages.value,
		});
		lastResult.value = { provider: "Drakon", data: data.data };
	} catch (error) {
		lastResult.value = {
			provider: "Drakon",
			error: error.response?.data?.message || error.message,
		};
	} finally {
		drakonImporting.value = false;
	}
};

onMounted(() => {
	loadBetinoviVendors();
	loadNexusProviders();
});
</script>

<route lang="yaml">
meta:
  action: read
  subject: games
</route>

<template>
	<div>
		<div class="mb-4">
			<h4 class="text-h4 mb-1">Oyun İçe Aktarma</h4>
			<p class="text-body-2 text-medium-emphasis">
				Sağlayıcı API'lerinden (Betinovi, Drakon, Nexus) yeni oyunları çeker ve
				veritabanına kaydeder.
			</p>
		</div>

		<VAlert type="info" variant="tonal" class="mb-4">
			<strong>Önemli:</strong> Yeni oyun eklerken mevcut oyunların görseli/ismi
			<strong>varsayılan olarak asla değiştirilmez</strong> — sadece durum, RTP,
			tip gibi bilgiler güncellenir. Bir sağlayıcıdaki tüm oyunların görselini
			toplu olarak yenilemek isterseniz her kartta bulunan
			<strong>"Görselleri de güncelle"</strong> seçeneğini açın. Bu seçenek
			açıkken de, kilitlenmiş (banner sütununda kilit ikonu olan) oyunların
			görseli hâlâ korunur.
		</VAlert>

		<VRow>
			<!-- Betinovi -->
			<VCol cols="12" md="4">
				<VCard>
					<VCardTitle class="d-flex align-center gap-2">
						<VIcon icon="tabler-cloud-download" color="primary" />
						Betinovi
					</VCardTitle>
					<VCardText>
						<VSelect
							v-model="betinoviSelectedVendor"
							:items="betinoviVendorOptions"
							item-title="title"
							item-value="value"
							label="Vendor"
							:loading="betinoviVendorsLoading"
							class="mb-2"
						/>
						<VSwitch
							v-model="betinoviForceImages"
							color="warning"
							density="compact"
							label="Görselleri de güncelle (dikkatli kullanın)"
						/>
					</VCardText>
					<VCardActions class="px-4 pb-4">
						<VBtn
							v-if="canManageGames"
							block
							color="primary"
							:loading="betinoviImporting"
							@click="importBetinovi"
						>
							<VIcon start icon="tabler-download" />
							İçe Aktar
						</VBtn>
					</VCardActions>
				</VCard>
			</VCol>

			<!-- Drakon -->
			<VCol cols="12" md="4">
				<VCard>
					<VCardTitle class="d-flex align-center gap-2">
						<VIcon icon="tabler-cloud-download" color="primary" />
						Drakon
					</VCardTitle>
					<VCardText>
						<p class="text-body-2 text-medium-emphasis mb-4">
							Drakon API'sinde vendor seçimi yoktur, tek seferde tüm oyun
							kataloğu çekilir.
						</p>
						<VSwitch
							v-model="drakonForceImages"
							color="warning"
							density="compact"
							label="Görselleri de güncelle (dikkatli kullanın)"
						/>
					</VCardText>
					<VCardActions class="px-4 pb-4">
						<VBtn
							v-if="canManageGames"
							block
							color="primary"
							:loading="drakonImporting"
							@click="importDrakon"
						>
							<VIcon start icon="tabler-download" />
							İçe Aktar
						</VBtn>
					</VCardActions>
				</VCard>
			</VCol>

			<!-- Nexus -->
			<VCol cols="12" md="4">
				<VCard>
					<VCardTitle class="d-flex align-center gap-2">
						<VIcon icon="tabler-cloud-download" color="primary" />
						Nexus
					</VCardTitle>
					<VCardText>
						<VSelect
							v-model="nexusSelectedProvider"
							:items="nexusProviderOptions"
							item-title="title"
							item-value="value"
							label="Sağlayıcı"
							:loading="nexusProvidersLoading"
							class="mb-2"
						/>
						<VSwitch
							v-model="nexusForceImages"
							color="warning"
							density="compact"
							label="Görselleri de güncelle (dikkatli kullanın)"
						/>
					</VCardText>
					<VCardActions class="px-4 pb-4">
						<VBtn
							v-if="canManageGames"
							block
							color="primary"
							:loading="nexusImporting"
							@click="importNexus"
						>
							<VIcon start icon="tabler-download" />
							İçe Aktar
						</VBtn>
					</VCardActions>
				</VCard>
			</VCol>
		</VRow>

		<!-- Sonuç paneli -->
		<VCard v-if="lastResult" class="mt-4">
			<VCardTitle class="d-flex align-center gap-2">
				<VIcon icon="tabler-report" />
				{{ lastResult.provider }} İçe Aktarma Sonucu
			</VCardTitle>
			<VCardText>
				<VAlert v-if="lastResult.error" type="error" variant="tonal">
					{{ lastResult.error }}
				</VAlert>
				<VRow v-else>
					<VCol
						v-for="stat in resultSummary"
						:key="stat.label"
						cols="6"
						md="2"
					>
						<VCard variant="tonal" :color="stat.color">
							<VCardText class="text-center">
								<div class="text-h5">{{ stat.value }}</div>
								<div class="text-caption">{{ stat.label }}</div>
							</VCardText>
						</VCard>
					</VCol>
				</VRow>

				<VExpansionPanels
					v-if="lastResult.data?.errors?.length"
					class="mt-4"
					variant="accordion"
				>
					<VExpansionPanel>
						<VExpansionPanelTitle>
							Hata Detayları ({{ lastResult.data.errors.length }})
						</VExpansionPanelTitle>
						<VExpansionPanelText>
							<div
								v-for="(err, idx) in lastResult.data.errors"
								:key="idx"
								class="text-body-2 mb-1"
							>
								<code>{{ err.game_code || err.vendor_code || err.provider_code }}</code>
								— {{ err.message }}
							</div>
						</VExpansionPanelText>
					</VExpansionPanel>
				</VExpansionPanels>
			</VCardText>
		</VCard>
	</div>
</template>
