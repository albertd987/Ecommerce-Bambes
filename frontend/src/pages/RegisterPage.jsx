import { useMemo, useState } from "react"
import Header from "@/components/Header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Link, useNavigate } from "react-router-dom"
import { useAuth } from "@/context/auth-context"
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

function PasswordInput({
  id,
  name,
  label,
  value,
  onChange,
  placeholder,
  error,
  capsLockOn,
  onKeyUp,
  onKeyDown,
}) {
  const { t } = useTranslation()

  return (
    <div className="space-y-2">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>

      <input
        id={id}
        name={name}
        type="password"
        required
        className={`w-full border rounded-md px-3 py-2 bg-background ${
          error ? "border-destructive" : ""
        }`}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        onKeyUp={onKeyUp}
        onKeyDown={onKeyDown}
      />

      {capsLockOn ? (
        <div className="flex items-center gap-2 rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-700">
          <AlertTriangle className="h-4 w-4" />
        <span>
          {label}: {t("register.capsLock.warning", "Majúscules activades")}
        </span>
        </div>
      ) : null}

      {error ? (
        <p className="text-sm text-red-600 dark:text-red-400">
          {Array.isArray(error) ? error[0] : error}
        </p>
      ) : null}
    </div>
  )
}

export default function RegisterPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { register } = useAuth()

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    passwordConfirmation: "",
  })

  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const [capsLock, setCapsLock] = useState({
    password: false,
    passwordConfirmation: false,
  })

  const passwordStrength = useMemo(
    () => getPasswordStrength(formData.password),
    [formData.password]
  )

  const passwordsMatch =
    formData.passwordConfirmation.length > 0 &&
    formData.password === formData.passwordConfirmation

  const strengthLabel =
    passwordStrength.label === "weak"
      ? t("register.strength.weak", "Feble")
      : passwordStrength.label === "medium"
      ? t("register.strength.medium", "Mitjana")
      : passwordStrength.label === "strong"
      ? t("register.strength.strong", "Forta")
      : passwordStrength.label === "veryStrong"
      ? t("register.strength.veryStrong", "Molt forta")
      : ""

  const handleCapsLock = (field) => (e) => {
    const isOn = e.getModifierState && e.getModifierState("CapsLock")
    setCapsLock((prev) => ({
      ...prev,
      [field]: !!isOn,
    }))
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))

    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: null }))
    }

    if (name === "passwordConfirmation" && errors.passwordConfirmation) {
      setErrors((prev) => ({ ...prev, passwordConfirmation: null }))
    }
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    setErrors({})
    setLoading(true)

    if (formData.password !== formData.passwordConfirmation) {
      setErrors({
        passwordConfirmation: t(
          "register.errors.confirmMismatch",
          "La confirmació no coincideix."
        ),
      })
      setLoading(false)
      return
    }

    const result = await register(
      formData.name,
      formData.email,
      formData.password,
      formData.passwordConfirmation
    )

    setLoading(false)

    if (result.success) {
      navigate("/verify-email")
    } else {
      if (result.errors) {
        setErrors(result.errors)
      } else {
        setErrors({ general: result.error })
      }
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto px-4 py-10 max-w-lg">
        <Card>
          <CardHeader>
            <CardTitle>{t("register.title", "Crear compte")}</CardTitle>
          </CardHeader>

          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4">
              {errors.general && (
                <div className="rounded-md bg-red-50 dark:bg-red-900/20 p-3 border border-red-200 dark:border-red-800">
                  <p className="text-sm text-red-800 dark:text-red-200">
                    {errors.general}
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <label htmlFor="name" className="text-sm font-medium">
                  {t("register.fullName", "Nom complet")}
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  className="w-full border rounded-md px-3 py-2 bg-background"
                  placeholder={t("register.placeholders.name", "El teu nom")}
                  value={formData.name}
                  onChange={handleChange}
                />
                {errors.name && (
                  <p className="text-sm text-red-600 dark:text-red-400">
                    {errors.name[0]}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium">
                  {t("register.email", "Correu electrònic")}
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  className="w-full border rounded-md px-3 py-2 bg-background"
                  placeholder={t("register.placeholders.email", "tu@exemple.com")}
                  value={formData.email}
                  onChange={handleChange}
                />
                {errors.email && (
                  <p className="text-sm text-red-600 dark:text-red-400">
                    {errors.email[0]}
                  </p>
                )}
              </div>

              <PasswordInput
                id="password"
                name="password"
                label={t("register.password", "Contrasenya")}
                value={formData.password}
                onChange={handleChange}
                placeholder={t("register.placeholders.password", "Mínim 8 caràcters")}
                error={errors.password}
                capsLockOn={capsLock.password}
                onKeyUp={handleCapsLock("password")}
                onKeyDown={handleCapsLock("password")}
              />

              {formData.password ? (
                <div className="rounded-2xl border bg-muted/20 p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="text-sm font-medium">
                      {t("register.strength.title", "Força de la contrasenya")}
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
                      text={t("register.rules.length", "Mínim 8 caràcters")}
                    />
                    <StrengthChecklistItem
                      ok={passwordStrength.checks.lowercase}
                      text={t("register.rules.lowercase", "Conté una lletra minúscula")}
                    />
                    <StrengthChecklistItem
                      ok={passwordStrength.checks.uppercase}
                      text={t("register.rules.uppercase", "Conté una lletra majúscula")}
                    />
                    <StrengthChecklistItem
                      ok={passwordStrength.checks.number}
                      text={t("register.rules.number", "Conté un número")}
                    />
                    <StrengthChecklistItem
                      ok={passwordStrength.checks.special}
                      text={t("register.rules.special", "Conté un caràcter especial")}
                    />
                  </ul>
                </div>
              ) : null}

              <PasswordInput
                id="passwordConfirmation"
                name="passwordConfirmation"
                label={t("register.passwordConfirm", "Confirmar contrasenya")}
                value={formData.passwordConfirmation}
                onChange={handleChange}
                placeholder={t(
                  "register.placeholders.passwordConfirm",
                  "Repeteix la contrasenya"
                )}
                error={errors.passwordConfirmation}
                capsLockOn={capsLock.passwordConfirmation}
                onKeyUp={handleCapsLock("passwordConfirmation")}
                onKeyDown={handleCapsLock("passwordConfirmation")}
              />

              {formData.passwordConfirmation ? (
                <p
                  className={`text-xs ${
                    passwordsMatch ? "text-green-600" : "text-destructive"
                  }`}
                >
                  {passwordsMatch
                    ? t("register.confirmation.match", "Les contrasenyes coincideixen")
                    : t(
                        "register.confirmation.noMatch",
                        "Les contrasenyes no coincideixen"
                      )}
                </p>
              ) : null}

              <Button className="w-full" size="lg" disabled={loading}>
                {loading
                  ? t("register.loading", "Carregant...")
                  : t("register.submit", "Registrar-me")}
              </Button>

              <p className="text-sm text-muted-foreground">
                {t("register.haveAccount", "Ja tens compte?")}{" "}
                <Link to="/login" className="underline">
                  {t("register.login", "Inicia sessió")}
                </Link>
              </p>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}