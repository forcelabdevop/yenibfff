"use client"

import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import {
  ChevronDown,
  ChevronLeft,
  Chrome,
  Eye,
  EyeOff,
  Lock,
  Mail,
  Send,
  Shield,
  Twitch,
  Wallet,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { ApiError } from "@/lib/api"
import { DEFAULT_FIAT, WEBSITE_NAME, backendUrl } from "@/lib/config"
import { useAuth, type RegisterChallenge } from "@/providers/auth-provider"
import { useSiteSettings } from "@/hooks/use-site-settings"

type Mode = "login" | "register" | "register-otp" | "otp"

interface AuthDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialMode?: Mode
}

const PHONE_DIAL_CODES = [
  { code: "+90", label: "TR +90" },
  { code: "+1", label: "US +1" },
  { code: "+44", label: "GB +44" },
  { code: "+49", label: "DE +49" },
  { code: "+7", label: "RU +7" },
  { code: "+380", label: "UA +380" },
  { code: "+994", label: "AZ +994" },
]

const EMAIL_DOMAIN_SUGGESTIONS = ["gmail.com", "hotmail.com", "outlook.com", "yahoo.com", "icloud.com"]

/** {{websiteName}} yer tutucusunu gerçek site adıyla değiştirir. */
function fill(value: string | undefined, fallback: string): string {
  const text = (value ?? "").trim() || fallback
  return text.split("{{websiteName}}").join(WEBSITE_NAME)
}

/**
 * Login/Register/OTP modalı. Kayıt aşamalı yürür: Aşama 1'de sadece
 * e-posta+şifre(+opsiyonel telefon/promo kodu) alınır, backend hesabı
 * oluşturup e-postaya 6 haneli kod gönderir (register() → RegisterChallenge).
 * Aşama 2'de bu kod "register-otp" ekranında doğrulanır (confirmRegistration())
 * ve ancak o zaman oturum açılır. Ad/soyad, doğum tarihi gibi bilgiler bu
 * akışın parçası değil — ayrı bir "Profili Tamamla" adımında istenecek.
 * auth-provider'daki login() MFA gerekiyorsa mfaRequired: true döner —
 * burada "otp" moduna geçiyoruz (bu, register-otp'den farklı bir akıştır).
 * Sol tanıtım paneli ve metinleri admin CMS'ten (casinoUi.authModal) beslenir.
 */
export function AuthDialog({ open, onOpenChange, initialMode = "login" }: AuthDialogProps) {
  const [mode, setMode] = useState<Mode>(initialMode)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [registerEmail, setRegisterEmail] = useState("")
  const [registerChallenge, setRegisterChallenge] = useState<RegisterChallenge | null>(null)
  const [otpCode, setOtpCode] = useState("")
  const [marketingConsent, setMarketingConsent] = useState(true)
  const [cooldown, setCooldown] = useState(0)
  const { login, register, confirmRegistration, resendRegistrationOtp, validateOtp } = useAuth()
  const { settings } = useSiteSettings()

  const promo = settings?.authModal ?? {}
  const promoEnabled = promo.enabled !== false && mode !== "otp"
  const showSocials = promo.showSocialLogins !== false && mode !== "otp" && mode !== "register-otp"
  const promoImage = promo.image ? backendUrl(promo.image) : "/images/auth-promo-default.png"
  const brandLogo = settings?.logo ? backendUrl(settings.logo) : ""
  const promoTitle = fill(promo.title, "WELCOME BONUS")
  const promoHighlight = fill(promo.highlight, "UP TO 590%")
  const promoSubtitle = fill(promo.subtitle, "+ 225 Free Spins")
  const termsText = fill(
    promo.termsText,
    "By accessing you confirm that you are at least 18 years old and agree to the Terms of service",
  )

  // Dialog kapanınca unmount olmuyor, bu yüzden initialMode prop'u her
  // açılışta iç state'e senkronize edilmeli.
  useEffect(() => {
    if (open) setMode(initialMode)
  }, [open, initialMode])

  // register-otp ekranındaki "Yeniden gönder" sayacı.
  useEffect(() => {
    if (mode !== "register-otp" || cooldown <= 0) return
    const timer = window.setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000)
    return () => window.clearInterval(timer)
  }, [mode, cooldown])

  if (!open) return null

  function close() {
    setError(null)
    setPending(false)
    setMode(initialMode)
    setRegisterEmail("")
    setRegisterChallenge(null)
    setOtpCode("")
    setCooldown(0)
    onOpenChange(false)
  }

  function switchMode(next: Mode) {
    setError(null)
    setMode(next)
  }

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setPending(true)
    const form = new FormData(e.currentTarget)
    try {
      const result = await login(
        String(form.get("identifier") ?? ""),
        String(form.get("password") ?? ""),
      )
      if (result.mfaRequired) setMode("otp")
      else close()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Giriş başarısız oldu.")
    } finally {
      setPending(false)
    }
  }

  async function handleRegister(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setPending(true)
    const form = new FormData(e.currentTarget)
    const phoneDigits = String(form.get("phoneNumber") ?? "").replace(/\D/g, "")
    const phone = phoneDigits ? `${String(form.get("phoneCode") ?? "+90")}${phoneDigits}` : ""
    const affiliate = String(form.get("affiliate") ?? "").trim()
    const payload = {
      email: registerEmail.trim(),
      password: String(form.get("password") ?? ""),
      phone,
      affiliate: affiliate || undefined,
      fiatCurrency: DEFAULT_FIAT,
    }
    try {
      const challenge = await register(payload)
      setRegisterChallenge(challenge)
      setCooldown(challenge.cooldownRemainingSeconds)
      setOtpCode("")
      setMode("register-otp")
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Kayıt başarısız oldu.")
    } finally {
      setPending(false)
    }
  }

  async function handleRegisterOtpConfirm(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!registerChallenge) return
    setError(null)
    setPending(true)
    try {
      await confirmRegistration(registerChallenge.challengeId, otpCode, marketingConsent)
      close()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Kod doğrulanamadı.")
    } finally {
      setPending(false)
    }
  }

  async function handleResendRegistrationOtp() {
    if (!registerChallenge || cooldown > 0) return
    setError(null)
    try {
      const next = await resendRegistrationOtp(registerChallenge.challengeId)
      setRegisterChallenge(next)
      setCooldown(next.cooldownRemainingSeconds)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Kod yeniden gönderilemedi.")
    }
  }

  async function handleOtp(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setPending(true)
    const form = new FormData(e.currentTarget)
    try {
      await validateOtp(String(form.get("code") ?? ""))
      close()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Kod doğrulanamadı.")
    } finally {
      setPending(false)
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={
        mode === "login"
          ? "Giriş yap"
          : mode === "register"
            ? "Kayıt ol"
            : mode === "register-otp"
              ? "E-posta doğrulama"
              : "Doğrulama kodu"
      }
      onClick={(e) => {
        if (e.target === e.currentTarget) close()
      }}
    >
      <div
        className={cn(
          "relative grid w-full overflow-hidden rounded-2xl border border-border bg-card shadow-2xl",
          promoEnabled ? "max-w-3xl md:grid-cols-2" : "max-w-md",
        )}
      >
        <button
          type="button"
          onClick={close}
          aria-label="Kapat"
          className="absolute right-4 top-4 z-10 text-muted-foreground transition-colors hover:text-foreground"
        >
          <X className="size-5" aria-hidden="true" />
        </button>

        {/* Sol tanıtım paneli (CMS'ten) */}
        {promoEnabled && (
          <aside
            className="relative hidden flex-col items-center justify-center gap-6 overflow-hidden p-8 text-center md:flex"
            style={{
              background:
                "radial-gradient(192.24% 100% at 100% 0, #ff003666 0, #ff003629 35.87%, #ff003600 55.93% 100%), #151d28",
            }}
          >
            {brandLogo ? (
              <img src={brandLogo || "/placeholder.svg"} alt={WEBSITE_NAME} className="h-8 w-auto object-contain" />
            ) : (
              <span className="text-xl font-extrabold tracking-tight text-foreground">{WEBSITE_NAME}</span>
            )}

            {promoImage && (
              <img
                src={promoImage || "/placeholder.svg"}
                alt=""
                aria-hidden="true"
                className="max-h-64 w-auto object-contain drop-shadow-2xl"
              />
            )}

            <div className="space-y-1">
              <h3 className="text-2xl font-extrabold leading-tight text-foreground text-balance">{promoTitle}</h3>
              <p className="text-2xl font-extrabold leading-tight text-primary text-balance">{promoHighlight}</p>
              <p className="pt-1 text-sm font-medium text-muted-foreground">{promoSubtitle}</p>
            </div>
          </aside>
        )}

        {/* Sağ form paneli */}
        <div className="max-h-[85vh] overflow-y-auto p-6 sm:p-8">
          {mode === "login" || mode === "register" ? (
            <div className="mb-6 flex items-center gap-6 border-b border-border">
              <TabButton active={mode === "login"} onClick={() => switchMode("login")}>
                Giriş
              </TabButton>
              <TabButton active={mode === "register"} onClick={() => switchMode("register")}>
                Kayıt Ol
              </TabButton>
            </div>
          ) : mode === "otp" ? (
            <div className="mb-6">
              <h2 className="text-lg font-semibold tracking-tight text-foreground">Doğrulama kodu</h2>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                Hesabına bağlı doğrulama uygulamasındaki kodu gir.
              </p>
            </div>
          ) : (
            <div className="mb-6 flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setRegisterChallenge(null)
                  setOtpCode("")
                  setMode("register")
                }}
                aria-label="Geri"
                className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:text-foreground"
              >
                <ChevronLeft className="size-4" aria-hidden="true" />
              </button>
              <h2 className="text-lg font-semibold tracking-tight text-foreground">E-posta doğrulama</h2>
            </div>
          )}

          {error && (
            <p role="alert" className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          {mode === "login" && (
            <form onSubmit={handleLogin} className="flex flex-col gap-4">
              <IconField
                icon={<Mail className="size-4" aria-hidden="true" />}
                label="E-posta"
                name="identifier"
                type="text"
                autoComplete="username"
                placeholder="E-posta adresiniz"
                required
              />
              <PasswordField label="Şifre" name="password" autoComplete="current-password" placeholder="Şifreniz" required />

              <button
                type="button"
                className="-mt-1 self-start text-sm font-medium text-sky-400 transition-colors hover:text-sky-300"
                title="Yakında"
              >
                Şifreni mi unuttun?
              </button>

              <p className="text-xs leading-relaxed text-muted-foreground">{termsText}</p>

              <SubmitButton pending={pending}>Giriş yap</SubmitButton>

              {showSocials && <SocialRow />}
            </form>
          )}

          {mode === "register" && (
            <form onSubmit={handleRegister} className="flex flex-col gap-3.5">
              <EmailAutocompleteField value={registerEmail} onChange={setRegisterEmail} />
              <PasswordField
                label="Şifre"
                name="password"
                autoComplete="new-password"
                minLength={8}
                required
                hint="En az 8 karakter, 1 büyük harf ve 1 rakam içermeli."
              />

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">Telefon (opsiyonel)</label>
                <div className="flex gap-2">
                  <select
                    name="phoneCode"
                    defaultValue="+90"
                    aria-label="Ülke kodu"
                    className="w-24 shrink-0 rounded-lg border border-input bg-background px-2 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-ring focus:ring-1 focus:ring-ring"
                  >
                    {PHONE_DIAL_CODES.map((entry) => (
                      <option key={entry.code} value={entry.code}>
                        {entry.label}
                      </option>
                    ))}
                  </select>
                  <input
                    name="phoneNumber"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel"
                    placeholder="Telefon numarası"
                    className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-1 focus:ring-ring"
                  />
                </div>
              </div>

              <details className="group rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-muted-foreground">
                <summary className="flex cursor-pointer list-none items-center justify-between font-medium text-foreground/80">
                  Referans/promosyon kodu gir
                  <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true" />
                </summary>
                <input
                  name="affiliate"
                  type="text"
                  placeholder="Promosyon kodu"
                  className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-1 focus:ring-ring"
                />
              </details>

              <label className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
                <input
                  type="checkbox"
                  name="ageConfirm"
                  required
                  defaultChecked
                  className="mt-0.5 size-4 shrink-0 rounded border-input accent-primary"
                />
                {termsText}
              </label>

              <SubmitButton pending={pending}>Hesap oluştur</SubmitButton>

              {showSocials && <SocialRow />}
            </form>
          )}

          {mode === "register-otp" && (
            <div className="flex flex-col gap-4">
              <div className="text-sm leading-relaxed text-muted-foreground">
                Aşağıdaki adrese gönderilen kodu gir:
                <div className="mt-1 font-semibold text-foreground">{registerChallenge?.maskedDestination}</div>
                <button
                  type="button"
                  title="Yakında"
                  className="mt-1 text-xs font-medium text-sky-400 transition-colors hover:text-sky-300"
                >
                  E-postayı kontrol et
                </button>
              </div>

              <form onSubmit={handleRegisterOtpConfirm} className="flex flex-col gap-4">
                <OtpBoxes onComplete={setOtpCode} />

                <label className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={marketingConsent}
                    onChange={(e) => setMarketingConsent(e.target.checked)}
                    className="mt-0.5 size-4 shrink-0 rounded border-input accent-primary"
                  />
                  Promosyon mesajları almak istiyorum
                </label>

                <SubmitButton pending={pending}>Doğrula</SubmitButton>

                <p className="text-center text-xs text-muted-foreground">
                  Kod gelmedi mi?{" "}
                  <button
                    type="button"
                    onClick={handleResendRegistrationOtp}
                    disabled={cooldown > 0}
                    className="font-medium text-sky-400 transition-colors hover:text-sky-300 disabled:cursor-not-allowed disabled:text-muted-foreground"
                  >
                    {cooldown > 0 ? `Yeniden gönder (${cooldown}s)` : "Yeniden gönder"}
                  </button>
                </p>
              </form>
            </div>
          )}

          {mode === "otp" && (
            <form onSubmit={handleOtp} className="flex flex-col gap-3">
              <IconField label="6 haneli kod" name="code" type="text" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required />
              <SubmitButton pending={pending}>Doğrula</SubmitButton>
            </form>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative -mb-px border-b-2 pb-3 text-base font-semibold transition-colors",
        active ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  )
}

function IconField({
  icon,
  label,
  hint,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { icon?: React.ReactNode; label: string; hint?: string }) {
  const id = `field-${props.name}`
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {label}
      </label>
      <div className="relative">
        {icon && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">{icon}</span>
        )}
        <input
          id={id}
          className={cn(
            "w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-1 focus:ring-ring",
            icon && "pl-9",
            className,
          )}
          {...props}
        />
      </div>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </div>
  )
}

/**
 * E-posta alanı — "@" sonrasına yazılırken bilinen sağlayıcı alan adlarını
 * (gmail.com, hotmail.com...) altında öneri olarak listeler; tıklanınca
 * alanı tamamlar. Klavye kolaylığı için eklendi (bkz. kullanıcı isteği).
 */
function EmailAutocompleteField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [focused, setFocused] = useState(false)
  const atIndex = value.indexOf("@")
  const domainQuery = atIndex >= 0 ? value.slice(atIndex + 1) : null
  const suggestions =
    domainQuery !== null && !domainQuery.includes(".")
      ? EMAIL_DOMAIN_SUGGESTIONS.filter((domain) => domain.startsWith(domainQuery)).map(
          (domain) => value.slice(0, atIndex + 1) + domain,
        )
      : []
  const showSuggestions = focused && suggestions.length > 0 && !suggestions.includes(value)

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="field-email" className="text-xs font-medium text-muted-foreground">
        E-posta
      </label>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
          <Mail className="size-4" aria-hidden="true" />
        </span>
        <input
          id="field-email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="E-posta adresiniz"
          required
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className="w-full rounded-lg border border-input bg-background px-3 py-2.5 pl-9 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-1 focus:ring-ring"
        />
        {showSuggestions && (
          <ul className="absolute inset-x-0 top-full z-10 mt-1 overflow-hidden rounded-lg border border-border bg-card shadow-lg">
            {suggestions.map((suggestion) => (
              <li key={suggestion}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onChange(suggestion)
                    setFocused(false)
                  }}
                  className="block w-full px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  {suggestion}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

/**
 * 6 haneli tek-hane kutuları — yazınca otomatik ilerler, backspace ile
 * geri gider, tam kod yapıştırmayı destekler. onComplete her değişimde
 * güncel (tam olmasa da) kodu üst bileşene bildirir.
 */
function OtpBoxes({ length = 6, onComplete }: { length?: number; onComplete: (code: string) => void }) {
  const [digits, setDigits] = useState<string[]>(() => Array(length).fill(""))
  const inputsRef = useRef<Array<HTMLInputElement | null>>([])

  useEffect(() => {
    onComplete(digits.join(""))
    // onComplete referansı her render'da yeniden oluşabilir (setState), bu
    // yüzden bağımlılık dizisine eklenmiyor — yalnızca hane değişince tetiklenir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [digits])

  function handleChange(index: number, raw: string) {
    const char = raw.replace(/\D/g, "").slice(-1)
    setDigits((prev) => {
      const next = [...prev]
      next[index] = char
      return next
    })
    if (char && index < length - 1) inputsRef.current[index + 1]?.focus()
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputsRef.current[index - 1]?.focus()
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length)
    if (!text) return
    e.preventDefault()
    setDigits((prev) => {
      const next = [...prev]
      for (let i = 0; i < length; i += 1) next[i] = text[i] ?? next[i]
      return next
    })
    const lastIndex = Math.min(text.length, length) - 1
    inputsRef.current[Math.max(0, lastIndex)]?.focus()
  }

  return (
    <div className="flex items-center justify-center gap-2">
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(el) => {
            inputsRef.current[index] = el
          }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digit}
          onChange={(e) => handleChange(index, e.target.value)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onPaste={handlePaste}
          className="size-12 rounded-lg border border-input bg-background text-center text-lg font-semibold text-foreground outline-none transition-colors focus:border-ring focus:ring-1 focus:ring-ring"
          aria-label={`Doğrulama kodu ${index + 1}. hane`}
        />
      ))}
    </div>
  )
}

function PasswordField({
  label,
  hint,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  const [visible, setVisible] = useState(false)
  const id = `field-${props.name}`
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {label}
      </label>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
          <Lock className="size-4" aria-hidden="true" />
        </span>
        <input
          id={id}
          type={visible ? "text" : "password"}
          className="w-full rounded-lg border border-input bg-background px-3 py-2.5 pl-9 pr-10 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-1 focus:ring-ring"
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Şifreyi gizle" : "Şifreyi göster"}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-muted-foreground transition-colors hover:text-foreground"
        >
          {visible ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
        </button>
      </div>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </div>
  )
}

function SubmitButton({ pending, children }: { pending: boolean; children: React.ReactNode }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-1 inline-flex items-center justify-center rounded-lg bg-primary px-4 py-3 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20 transition-opacity hover:opacity-90 disabled:opacity-60"
    >
      {pending ? "İşleniyor…" : children}
    </button>
  )
}

/**
 * Hızlı giriş (sosyal) butonları — şimdilik yalnızca görsel; işlevi sonra
 * eklenecek. Kullanıcı bunları görsün diye render ediyoruz ama tıklama bir
 * şey yapmıyor.
 */
function SocialRow() {
  const buttons = [
    { key: "google", icon: <Chrome className="size-5" aria-hidden="true" />, label: "Google" },
    { key: "twitch", icon: <Twitch className="size-5" aria-hidden="true" />, label: "Twitch" },
    { key: "telegram", icon: <Send className="size-5" aria-hidden="true" />, label: "Telegram" },
    { key: "ton", icon: <Wallet className="size-5" aria-hidden="true" />, label: "TON" },
    { key: "keeper", icon: <Shield className="size-5" aria-hidden="true" />, label: "Keeper" },
  ]
  return (
    <div className="mt-2">
      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Or</span>
        <span className="h-px flex-1 bg-border" />
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        {buttons.map((b) => (
          <button
            key={b.key}
            type="button"
            title="Yakında"
            aria-label={b.label}
            className="flex size-11 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition-colors hover:text-foreground"
          >
            {b.icon}
          </button>
        ))}
        <button
          type="button"
          title="Yakında"
          aria-label="Daha fazla"
          className="flex size-11 items-center justify-center rounded-lg border border-border bg-background text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          +3
        </button>
      </div>
    </div>
  )
}
