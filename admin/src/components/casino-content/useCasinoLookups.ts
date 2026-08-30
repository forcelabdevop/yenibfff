// Mission/bonus editörlerinin seçenek kaynağı. Enum'lar backend
// `casinoRewardSchema` üzerinden gelir, böylece admin arayüzü ile motorun
// kabul ettiği değerler asla birbirinden ayrışmaz.
import axios from "@/plugins/axios"
import { ref } from "vue"

export interface LookupOptions {
  eventTypes: string[]
  metrics: string[]
  periods: string[]
  rewardTypes: string[]
  activations: string[]
  providers: string[]
  categories: string[]
}

const fallback: LookupOptions = {
  eventTypes: ["deposit", "wager", "win", "game-round", "login"],
  metrics: ["count", "amount"],
  periods: ["lifetime", "daily", "weekly", "monthly"],
  rewardTypes: ["none", "balance", "bonus", "free-spins", "xp"],
  activations: ["deposit", "instant"],
  providers: [],
  categories: [],
}

const options = ref<LookupOptions>({ ...fallback })
const loaded = ref(false)

export function useCasinoLookups() {
  async function loadOptions() {
    if (loaded.value) return options.value
    try {
      const { data } = await axios.get("/admin/content/lookups/options")
      options.value = { ...fallback, ...(data.data || {}) }
      loaded.value = true
    } catch {
      // Lookup başarısız olsa da editör kullanılabilir kalsın: enum'lar için
      // yerel yedek listeler devreye girer, yalnızca provider/kategori boş olur.
      options.value = { ...fallback }
    }
    return options.value
  }

  return { options, loadOptions }
}
