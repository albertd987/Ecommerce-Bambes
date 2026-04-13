import { useMemo, useState } from "react"
import Header from "@/components/Header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { resetPassword } from "@/services/api"
import { useTranslation } from "react-i18next"
import { AlertTriangle } from "lucide-react"

function getPasswordStrength(password) {
  if (!password) {
    return {
      score: 0,
      label: "",
      colorClass: "bg-muted",
      checks: {
        length: false,
        lowercase: false,
        uppercase: false,
        number: false,
        special: false,
      },
    }
  }

  const checks = {
    length: /^.{8,}$/.test(password),
    lowercase: /[a-z]/.test(password),
    uppercase: /[A-Z]/.test(password),
    number: /\d/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  }

  const score = Object.values(checks).filter(Boolean).length

  if (score <= 2) return { score, label: "weak", colorClass: "bg-destructive", checks }
  if (score === 3) return { score, label: "medium", colorClass: "bg-yellow-500", checks }
  if (score === 4) return { score, label: "strong", colorClass: "bg-blue-500", checks }

  return { score, label: "veryStrong", colorClass: "bg-green-600", checks }
}

function StrengthChecklistItem({ ok, text }) {
  return (
    <li className={`text-xs ${ok ? "text-foreground" : "text-muted-foreground"}`}>
      <span className="mr-2">{ok ? "✓" : "•"}</span>
      {text}
    </li>
  )
}

function PasswordField({
  label,
  value,
  onChange,
  placeholder,
  error,
  onKeyUp,
  onKeyDown,
  capsLockOn = false,
}) {
  const { t } = useTranslation()

  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-foreground">
        {label}
      </label>

      <input
        value={value}
        onChange={onChange}
        onKeyUp={onKeyUp}
        onKeyDown={onKeyDown}
        type="password"
        placeholder={placeholder}
        className={`w-full rounded-xl border bg-background px-4 py-3 text-sm outline-none transition-colors focus:border-foreground ${
          error ? "border-destructive" : ""
        }`}
      />

      {capsLockOn ? (
        <div className="mt-2 flex items-center gap-2 rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-700">
          <AlertTriangle className="h-4 w-4" />
          <span>{t("capsLock.warning", "Majúscules activades")}</span>
        </div>
      ) : null}

      {error ? <p className="mt-1 text-xs text-destructive">{error}</p> : null}
    </div>
  )
}

export default function ResetPasswordPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const token = searchParams.get("token") || ""
  const emailFromUrl = searchParams.get("email") || ""

  const [email, setEmail] = useState(emailFromUrl)
  const [password, setPassword] = useState("")
  const [passwordConfirmation, setPasswordConfirmation] = useState("")
  const [loading, setLoading] = useState(false)
  const [successMsg, setSuccessMsg] = useState("")
  const [errorMsg, setErrorMsg] = useState("")
  const [fieldErrors, setFieldErrors] = useState({})
  const [capsLock, setCapsLock] = useState({
    password: false,
    confirm: false,
  })

  const passwordStrength = useMemo(() => getPasswordStrength(password), [password])

  const handleCapsLock = (field) => (e) => {
    const isOn = e.getModifierState && e.getModifierState("CapsLock")
    setCapsLock((prev) => ({
      ...prev,
      [field]: !!isOn,
    }))
  }

  const strengthLabel =
    passwordStrength.label === "weak"
      ? t("resetPassword.strength.weak", "Feble")
      : passwordStrength.label === "medium"
      ? t("resetPassword.strength.medium", "Mitjana")
      : passwordStrength.label === "strong"
      ? t("resetPassword.strength.strong", "Forta")
      : passwordStrength.label === "veryStrong"
      ? t("resetPassword.strength.veryStrong", "Molt forta")
      : ""

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErrorMsg("")
    setSuccessMsg("")
    setFieldErrors({})

    if (!token) {
      setErrorMsg(t("resetPassword.errors.missingToken", "Falta el token de recuperació."))
      return
    }

    setLoading(true)

    try {
      const res = await resetPassword({
        token,
        email,
        password,
        password_confirmation: passwordConfirmation,
      })

      setSuccessMsg(
        res?.message ||
          t("resetPassword.success", "Contrasenya restablerta correctament.")
      )

      setTimeout(() => {
        navigate("/login")
      }, 1500)
    } catch (err) {
      const data = err?.response?.data

      if (data?.errors) {
        setFieldErrors(data.errors)
      }

      setErrorMsg(
        data?.message ||
          t("resetPassword.errors.generic", "No s’ha pogut restablir la contrasenya.")
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto px-4 py-10 max-w-lg">
        <Card>
          <CardHeader>
            <CardTitle>{t("resetPassword.title", "Nova contrasenya")}</CardTitle>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {successMsg ? (
                <div className="rounded-md border p-3 text-sm bg-muted/30">
                  {successMsg}
                </div>
              ) : null}

              {errorMsg ? (
                <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                  {errorMsg}
                </div>
              ) : null}

              <div className="space-y-2">
                <label className="text-sm font-medium">
                  {t("resetPassword.email", "Correu electrònic")}
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full border rounded-md px-3 py-2 bg-background"
                />
                {fieldErrors.email ? (
                  <p className="text-xs text-destructive">{fieldErrors.email[0]}</p>
                ) : null}
              </div>

              <PasswordField
                label={t("resetPassword.password", "Nova contrasenya")}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t("resetPassword.placeholders.password", "Mínim 8 caràcters")}
                error={fieldErrors.password?.[0]}
                onKeyUp={handleCapsLock("password")}
                onKeyDown={handleCapsLock("password")}
                capsLockOn={capsLock.password}
              />

              {password ? (
                <div className="rounded-2xl border bg-muted/20 p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="text-sm font-medium">
                      {t("resetPassword.strength.title", "Força de la contrasenya")}
                    </p>
                    <span className="text-xs font-medium text-muted-foreground">
                      {strengthLabel}
                    </span>
                  </div>

                  <div className="mb-4 flex gap-2">
                    {[1, 2, 3, 4, 5].map((level) => (
                      <div
                        key={level}
                        className={`h-2 flex-1 rounded-full ${
                          passwordStrength.score >= level
                            ? passwordStrength.colorClass
                            : "bg-muted"
                        }`}
                      />
                    ))}
                  </div>

                  <ul className="space-y-1.5">
                    <StrengthChecklistItem ok={passwordStrength.checks.length} text={t("resetPassword.rules.length", "Mínim 8 caràcters")} />
                    <StrengthChecklistItem ok={passwordStrength.checks.lowercase} text={t("resetPassword.rules.lowercase", "Conté una lletra minúscula")} />
                    <StrengthChecklistItem ok={passwordStrength.checks.uppercase} text={t("resetPassword.rules.uppercase", "Conté una lletra majúscula")} />
                    <StrengthChecklistItem ok={passwordStrength.checks.number} text={t("resetPassword.rules.number", "Conté un número")} />
                    <StrengthChecklistItem ok={passwordStrength.checks.special} text={t("resetPassword.rules.special", "Conté un caràcter especial")} />
                  </ul>
                </div>
              ) : null}

              <PasswordField
                label={t("resetPassword.passwordConfirm", "Confirma la contrasenya")}
                value={passwordConfirmation}
                onChange={(e) => setPasswordConfirmation(e.target.value)}
                placeholder={t("resetPassword.placeholders.passwordConfirm", "Repeteix la contrasenya")}
                error={fieldErrors.password?.[0] || fieldErrors.password_confirmation?.[0]}
                onKeyUp={handleCapsLock("confirm")}
                onKeyDown={handleCapsLock("confirm")}
                capsLockOn={capsLock.confirm}
              />

              <Button className="w-full" size="lg" disabled={loading}>
                {loading
                  ? t("resetPassword.loading", "Desant...")
                  : t("resetPassword.submit", "Restablir contrasenya")}
              </Button>

              <p className="text-sm text-muted-foreground">
                <Link to="/login" className="underline">
                  {t("resetPassword.backToLogin", "Tornar a iniciar sessió")}
                </Link>
              </p>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}