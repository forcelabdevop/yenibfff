"use client"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { Chrome, Eye, EyeOff, Lock, Mail, Send, Shield, Twitch, Wallet, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { ApiError } from "@/lib/api"
import { DEFAULT_FIAT, WEBSITE_NAME, backendUrl } from "@/lib/config"
import { useAuth } from "@/providers/auth-provider"
import { useSiteSettings } from "@/hooks/use-site-settings"

type Mode = "login" | "register" | "otp"

interface AuthDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialMode?: Mode
}

/** {{websiteName}} yer tutucusunu gerçek site adıyla değiştirir. */
function fill(value: string | undefined, fallback: string): string {
  const text = (value ?? "").trim() || fallback
  return text.split("{{websiteName}}").join(WEBSITE_NAME)
}

/**
 * Login/Register/OTP modalı. auth-provider'daki login() MFA gerekiyorsa
 * mfaRequired: true döner — burada OTP moduna geçiyoruz. Sol tanıtım paneli
 * ve metinleri admin CMS'ten (casinoUi.authModal) beslenir.
 */
export function AuthDialog({ open, onOpenChange, initialMode = "login" }: AuthDialogProps) {
  const [mode, setMode] = useState<Mode>(initialMode)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const { login, register, validateOtp } = useAuth()
  const { settings } = useSiteSettings()

  const promo = settings?.authModal ?? {}
  const promoEnabled = promo.enabled !== false && mode !== "otp"
  const showSocials = promo.showSocialLogins !== false && mode !== "otp"
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

  if (!open) return null

  function close() {
    setError(null)
    setPending(false)
    setMode(initialMode)
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
    const payload = {
      email: String(form.get("email") ?? ""),
      username: String(form.get("username") ?? ""),
      phone: String(form.get("phone") ?? ""),
      name: String(form.get("name") ?? ""),
      birthday: String(form.get("birthday") ?? ""),
      password: String(form.get("password") ?? ""),
      fiatCurrency: DEFAULT_FIAT,
    }
    try {
      await register(payload)
      close()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Kayıt başarısız oldu.")
    } finally {
      setPending(false)
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
      aria-label={mode === "login" ? "Giriş yap" : mode === "register" ? "Kayıt ol" : "Doğrulama kodu"}
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
          {mode !== "otp" ? (
            <div className="mb-6 flex items-center gap-6 border-b border-border">
              <TabButton active={mode === "login"} onClick={() => switchMode("login")}>
                Giriş
              </TabButton>
              <TabButton active={mode === "register"} onClick={() => switchMode("register")}>
                Kayıt Ol
              </TabButton>
            </div>
          ) : (
            <div className="mb-6">
              <h2 className="text-lg font-semibold tracking-tight text-foreground">Doğrulama kodu</h2>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                Hesabına bağlı doğrulama uygulamasındaki kodu gir.
              </p>
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
              <IconField icon={<Mail className="size-4" aria-hidden="true" />} label="E-posta" name="email" type="email" autoComplete="email" placeholder="E-posta adresiniz" required />
              <IconField label="Kullanıcı adı" name="username" type="text" autoComplete="username" required />
              <IconField label="Ad" name="name" type="text" autoComplete="name" required />
              <IconField label="Telefon" name="phone" type="tel" autoComplete="tel" placeholder="+905551234567" required />
              <IconField label="Doğum tarihi" name="birthday" type="date" required />
              <PasswordField
                label="Şifre"
                name="password"
                autoComplete="new-password"
                minLength={8}
                required
                hint="En az 8 karakter, 1 büyük harf ve 1 rakam içermeli."
              />

              <p className="text-xs leading-relaxed text-muted-foreground">{termsText}</p>

              <SubmitButton pending={pending}>Hesap oluştur</SubmitButton>

              {showSocials && <SocialRow />}
            </form>
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
