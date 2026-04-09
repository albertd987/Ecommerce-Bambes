import { useMemo, useState } from "react"
import Header from "@/components/Header"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/context/auth-context"
import { Link, useNavigate } from "react-router-dom"
import { changePassword } from "@/services/api"
import { useTranslation } from "react-i18next"
import { Card, CardContent } from "@/components/ui/card"
import { AlertTriangle, ArrowLeft, KeyRound, Shield } from "lucide-react"

function PasswordField({
  label,
  value,
  onChange,
  placeholder,
  error,
  autoComplete,
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
        autoComplete={autoComplete}
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

  if (score <= 2) {
    return {
      score,
      label: "weak",
      colorClass: "bg-destructive",
      checks,
    }
  }

  if (score === 3) {
    return {
      score,
      label: "medium",
      colorClass: "bg-yellow-500",
      checks,
    }
  }

  if (score === 4) {
    return {
      score,
      label: "strong",
      colorClass: "bg-blue-500",
      checks,
    }
  }

  return {
    score,
    label: "veryStrong",
    colorClass: "bg-green-600",
    checks,
  }
}

function StrengthChecklistItem({ ok, text }) {
  return (
    <li className={`text-xs ${ok ? "text-foreground" : "text-muted-foreground"}`}>
      <span className="mr-2">{ok ? "✓" : "•"}</span>
      {text}
    </li>
  )
}

export default function ChangePasswordPage() {
  const { t } = useTranslation()
  const { isLoggedIn } = useAuth()
  const navigate = useNavigate()

  const [currentPassword, setCurrentPassword] = useState("")
  const [password, setPassword] = useState("")
  const [passwordConfirmation, setPasswordConfirmation] = useState("")

  const [loading, setLoading] = useState(false)
  const [successMsg, setSuccessMsg] = useState("")
  const [errorMsg, setErrorMsg] = useState("")
  const [fieldErrors, setFieldErrors] = useState({})

  const [capsLock, setCapsLock] = useState({
    current: false,
    next: false,
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

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto max-w-2xl px-4 py-10">
          <Card className="rounded-2xl border shadow-sm">
            <CardContent className="p-6">
              <p className="mb-4 text-muted-foreground">
                {t(
                  "changePassword.notLoggedIn",
                  "No has iniciat sessió. Entra per canviar la teva contrasenya."
                )}
              </p>
              <Link to="/login">
                <Button>{t("auth.login", "Iniciar sessió")}</Button>
              </Link>
            </CardContent>
          </Card>
        </main>
      </div>
    )
  }

  const resetMessages = () => {
    setSuccessMsg("")
    setErrorMsg("")
    setFieldErrors({})
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    resetMessages()

    if (!currentPassword || !password || !passwordConfirmation) {
      setErrorMsg(t("changePassword.errors.fillAll", "Omple tots els camps."))
      return
    }

    if (password !== passwordConfirmation) {
      setFieldErrors({
        password_confirmation: [
          t(
            "changePassword.errors.confirmMismatch",
            "La confirmació no coincideix."
          ),
        ],
      })
      return
    }

    if (password.length < 8) {
      setFieldErrors({
        password: [
          t(
            "changePassword.errors.minLength",
            "La nova contrasenya ha de tenir mínim 8 caràcters."
          ),
        ],
      })
      return
    }

    setLoading(true)
    try {
      const res = await changePassword({
        current_password: currentPassword,
        password,
        password_confirmation: passwordConfirmation,
      })

      setSuccessMsg(
        res?.message ||
          t(
            "changePassword.success",
            "Contrasenya actualitzada correctament."
          )
      )
      setCurrentPassword("")
      setPassword("")
      setPasswordConfirmation("")
      setCapsLock({
        current: false,
        next: false,
        confirm: false,
      })
    } catch (err) {
      const status = err?.response?.status
      const data = err?.response?.data

      if (status === 422 && data?.errors) {
        setFieldErrors(data.errors)
        setErrorMsg(
          t("changePassword.errors.reviewFields", "Revisa els camps marcats.")
        )
      } else {
        setErrorMsg(
          data?.message ||
            err.message ||
            t(
              "changePassword.errors.generic",
              "Error canviant la contrasenya."
            )
        )
      }
    } finally {
      setLoading(false)
    }
  }

  const strengthLabel =
    passwordStrength.label === "weak"
      ? t("changePassword.strength.weak", "Feble")
      : passwordStrength.label === "medium"
      ? t("changePassword.strength.medium", "Mitjana")
      : passwordStrength.label === "strong"
      ? t("changePassword.strength.strong", "Forta")
      : passwordStrength.label === "veryStrong"
      ? t("changePassword.strength.veryStrong", "Molt forta")
      : ""

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto max-w-4xl px-4 py-10">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">
              {t("profile.sections.security", "Seguretat")}
            </p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">
              {t("changePassword.title", "Canviar contrasenya")}
            </h1>
          </div>

          <Button variant="outline" onClick={() => navigate("/profile")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t("changePassword.backToProfile", "Tornar al perfil")}
          </Button>
        </div>

        <Card className="rounded-3xl border shadow-sm">
          <CardContent className="p-6 md:p-8">
            <div className="mb-8 flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
              <div className="flex items-start gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
                  <KeyRound className="h-7 w-7" />
                </div>

                <div>
                  <h2 className="text-xl font-semibold">
                    {t("changePassword.title", "Canviar contrasenya")}
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t(
                      "changePassword.description",
                      "Introdueix la contrasenya actual i la nova contrasenya."
                    )}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-2xl bg-muted/50 px-4 py-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-background">
                  <Shield className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-medium">
                    {t("profile.sections.security", "Seguretat")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t(
                      "changePassword.helper",
                      "Protegeix el teu compte amb una contrasenya segura."
                    )}
                  </p>
                </div>
              </div>
            </div>

            {successMsg ? (
              <div className="mb-4 rounded-2xl border border-border bg-muted/40 p-4 text-sm">
                ✅ {successMsg}
              </div>
            ) : null}

            {errorMsg ? (
              <div className="mb-4 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                {errorMsg}
              </div>
            ) : null}

            <form className="space-y-5" onSubmit={handleSubmit}>
              <PasswordField
                label={t("changePassword.fields.current.label", "Contrasenya actual")}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder={t(
                  "changePassword.fields.current.placeholder",
                  "Introdueix la teva contrasenya actual"
                )}
                autoComplete="current-password"
                error={fieldErrors?.current_password?.[0]}
                onKeyUp={handleCapsLock("current")}
                onKeyDown={handleCapsLock("current")}
                capsLockOn={capsLock.current}
              />

              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <PasswordField
                    label={t("changePassword.fields.new.label", "Nova contrasenya")}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t(
                      "changePassword.fields.new.placeholder",
                      "Introdueix la teva nova contrasenya"
                    )}
                    autoComplete="new-password"
                    error={fieldErrors?.password?.[0]}
                    onKeyUp={handleCapsLock("next")}
                    onKeyDown={handleCapsLock("next")}
                    capsLockOn={capsLock.next}
                  />

                  {password ? (
                    <div className="mt-3 rounded-2xl border bg-muted/20 p-4">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <p className="text-sm font-medium">
                          {t("changePassword.strength.title", "Força de la contrasenya")}
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
                        <StrengthChecklistItem
                          ok={passwordStrength.checks.length}
                          text={t(
                            "changePassword.rules.length",
                            "Mínim 8 caràcters"
                          )}
                        />
                        <StrengthChecklistItem
                          ok={passwordStrength.checks.lowercase}
                          text={t(
                            "changePassword.rules.lowercase",
                            "Conté una lletra minúscula"
                          )}
                        />
                        <StrengthChecklistItem
                          ok={passwordStrength.checks.uppercase}
                          text={t(
                            "changePassword.rules.uppercase",
                            "Conté una lletra majúscula"
                          )}
                        />
                        <StrengthChecklistItem
                          ok={passwordStrength.checks.number}
                          text={t(
                            "changePassword.rules.number",
                            "Conté un número"
                          )}
                        />
                        <StrengthChecklistItem
                          ok={passwordStrength.checks.special}
                          text={t(
                            "changePassword.rules.special",
                            "Conté un caràcter especial"
                          )}
                        />
                      </ul>
                    </div>
                  ) : null}
                </div>

                <PasswordField
                  label={t(
                    "changePassword.fields.confirm.label",
                    "Confirma la nova contrasenya"
                  )}
                  value={passwordConfirmation}
                  onChange={(e) => setPasswordConfirmation(e.target.value)}
                  placeholder={t(
                    "changePassword.fields.confirm.placeholder",
                    "Confirma la teva nova contrasenya"
                  )}
                  autoComplete="new-password"
                  error={fieldErrors?.password_confirmation?.[0]}
                  onKeyUp={handleCapsLock("confirm")}
                  onKeyDown={handleCapsLock("confirm")}
                  capsLockOn={capsLock.confirm}
                />
              </div>

              <div className="flex flex-col gap-3 pt-4 sm:flex-row">
                <Button type="submit" disabled={loading}>
                  {loading
                    ? t("changePassword.actions.changing", "Canviant...")
                    : t("changePassword.actions.submit", "Canviar contrasenya")}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate("/profile")}
                >
                  {t("profileEdit.actions.cancel", "Cancel·lar")}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}