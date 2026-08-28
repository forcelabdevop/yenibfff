"use client"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"
import { ApiError } from "@/lib/api"
import { DEFAULT_FIAT } from "@/lib/config"
import { useAuth } from "@/providers/auth-provider"

type Mode = "login" | "register" | "otp"

interface AuthDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialMode?: Mode
}

/**
 * Login/Register/OTP modalı. auth-provider'daki login() MFA gerekiyorsa
 * mfaRequired: true döner — burada OTP moduna geçiyoruz.
 */
export function AuthDialog({ open, onOpenChange, initialMode = "login" }: AuthDialogProps) {
  const [mode, setMode] = useState<Mode>(initialMode)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const { login, register, validateOtp } = useAuth()

  // Dialog kapanınca unmount olmuyor, bu yüzden initialMode prop'u her
  // açılışta iç state'e senkronize edilmeli (aksi halde "Kayıt ol" tıklaması
  // önceki oturumda kalan "login" modunu gösterir).
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
      if (result.mfaRequired) {
        setMode("otp")
      } else {
        close()
      }
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

  // AuthDialog `backdrop-blur` uygulanan bir header/kart içinde render edilebiliyor.
  // `backdrop-filter` (ve `transform`/`filter`), fixed-positioned elemanlar için
  // ata elemanı yeni bir containing block yapar; bu da `fixed inset-0`'ın viewport
  // yerine o küçük atanın kutusuna göre konumlanmasına ve dialogun ekranın üst
  // kısmına sıkışıp kalmasına yol açar. document.body'ye portalladığımızda bu
  // sorunu kökten çözüyoruz.
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
      <div className="relative w-full max-w-sm rounded-lg border border-border bg-card p-6 shadow-2xl">
        <button
          type="button"
          onClick={close}
          aria-label="Kapat"
          className="absolute right-4 top-4 text-muted-foreground transition-colors hover:text-foreground"
        >
          <X className="size-4" aria-hidden="true" />
        </button>

        <h2 className="text-lg font-semibold tracking-tight text-foreground">
          {mode === "login" && "Giriş yap"}
          {mode === "register" && "Hesap oluştur"}
          {mode === "otp" && "Doğrulama kodu"}
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          {mode === "login" && "Kullanıcı adı, e-posta veya telefon ile giriş yap."}
          {mode === "register" && "18 yaş ve üzeri olmalısın."}
          {mode === "otp" && "Hesabına bağlı doğrulama uygulamasındaki kodu gir."}
        </p>

        {error && (
          <p role="alert" className="mt-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        {mode === "login" && (
          <form onSubmit={handleLogin} className="mt-5 flex flex-col gap-3">
            <Field label="Kullanıcı adı, e-posta veya telefon" name="identifier" type="text" autoComplete="username" required />
            <Field label="Şifre" name="password" type="password" autoComplete="current-password" required />
            <SubmitButton pending={pending}>Giriş yap</SubmitButton>
          </form>
        )}

        {mode === "register" && (
          <form onSubmit={handleRegister} className="mt-5 flex flex-col gap-3">
            <Field label="Kullanıcı adı" name="username" type="text" autoComplete="username" required />
            <Field label="Ad" name="name" type="text" autoComplete="name" required />
            <Field label="E-posta" name="email" type="email" autoComplete="email" required />
            <Field label="Telefon" name="phone" type="tel" autoComplete="tel" placeholder="+905551234567" required />
            <Field label="Doğum tarihi" name="birthday" type="date" required />
            <Field
              label="Şifre"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              hint="En az 8 karakter, 1 büyük harf ve 1 rakam içermeli."
            />
            <SubmitButton pending={pending}>Hesap oluştur</SubmitButton>
          </form>
        )}

        {mode === "otp" && (
          <form onSubmit={handleOtp} className="mt-5 flex flex-col gap-3">
            <Field label="6 haneli kod" name="code" type="text" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required />
            <SubmitButton pending={pending}>Doğrula</SubmitButton>
          </form>
        )}

        {mode !== "otp" && (
          <p className="mt-4 text-center text-sm text-muted-foreground">
            {mode === "login" ? "Hesabın yok mu? " : "Zaten hesabın var mı? "}
            <button
              type="button"
              onClick={() => {
                setError(null)
                setMode(mode === "login" ? "register" : "login")
              }}
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              {mode === "login" ? "Kayıt ol" : "Giriş yap"}
            </button>
          </p>
        )}
      </div>
    </div>,
    document.body,
  )
}

function Field({
  label,
  hint,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  const id = `field-${props.name}`
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {label}
      </label>
      <input
        id={id}
        className={cn(
          "rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-1 focus:ring-ring",
          className,
        )}
        {...props}
      />
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </div>
  )
}

function SubmitButton({ pending, children }: { pending: boolean; children: React.ReactNode }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-2 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
    >
      {pending ? "İşleniyor…" : children}
    </button>
  )
}
