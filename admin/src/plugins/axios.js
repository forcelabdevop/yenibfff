import router from '@/router'
import axios from 'axios'

const axiosIns = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  adapter: 'xhr',
  env: {
    FormData: globalThis.FormData,
    Blob: globalThis.Blob,
  },
})

axiosIns.interceptors.request.use(config => {
  const token = localStorage.getItem('accessToken')

  if (token) {
    config.headers = config.headers || {}

    // Token may be stored as JSON string ("...") or as a raw string.
    let parsedToken = token
    try {
      parsedToken = JSON.parse(token)
    } catch (e) {
      // ignore
    }

    config.headers.Authorization = `Bearer ${parsedToken}`
  }

  return config
})

// Ayni anda birden fazla istek 401 donebilir (bildirimler, liste, istatistik...).
// Her biri ayri ayri router.push('/login') cagirirsa yaris durumu olusur ve
// router "resolve" hatasi firlatip sayfayi bos/bozuk bir ara durumda birakabilir.
// Bu bayrak, yonlendirmenin session basina yalnizca BIR KEZ tetiklenmesini saglar.
let isRedirectingToLogin = false

axiosIns.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401 && !isRedirectingToLogin) {
      isRedirectingToLogin = true
      localStorage.removeItem('userData')
      localStorage.removeItem('accessToken')
      localStorage.removeItem('userAbilities')
      localStorage.removeItem('userPermissions')
      localStorage.removeItem('adminMfaChallenge')

      router.push('/login').catch(() => {
        // Zaten /login'deyse veya navigasyon iptal edilirse burasi calisir; yut.
      }).finally(() => {
        isRedirectingToLogin = false
      })
    }

    return Promise.reject(error)
  },
)

export default axiosIns
