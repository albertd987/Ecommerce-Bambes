import { useState } from "react"
import Header from "@/components/Header"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/context/auth-context"
import { Link, useNavigate } from "react-router-dom"
import { changePassword } from "@/services/api"
import { useTranslation } from "react-i18next"
import { Card, CardContent } from "@/components/ui/card"
import { ArrowLeft, KeyRound, Shield } from "lucide-react"

function PasswordField({
  label,
  value,
  onChange,
  placeholder,
  error,
  autoComplete,
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-foreground">
        {label}
      </label>
      <input
        value={value}
        onChange={onChange}
        type="password"
        autoComplete={autoComplete}
        placeholder={placeholder}
        className={`w-full rounded-xl border bg-background px-4 py-3 text-sm outline-none transition-colors focus:border-foreground ${
          error ? "border-destructive" : ""
        }`}
      />
      {error ? <p className="mt-1 text-xs text-destructive">{error}</p> : null}
    </div>
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
                <Button>{t("auth.login.title", "Iniciar sessió")}</Button>
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

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto max-w-4xl px-4 py-8 sm:py-10">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">
              {t("profile.sections.security", "Seguretat")}
            </p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">
              {t("changePassword.title", "Canviar contrasenya")}
            </h1>
          </div>

          <Button variant="outline" className="min-h-[44px] w-full sm:w-auto" onClick={() => navigate("/profile")}>
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
              />

              <div className="grid gap-5 md:grid-cols-2">
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
                />

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
                />
              </div>

              <div className="flex flex-col gap-3 pt-4 sm:flex-row">
                <Button type="submit" disabled={loading} className="min-h-[44px] w-full sm:w-auto">
                  {loading
                    ? t("changePassword.actions.changing", "Canviant...")
                    : t("changePassword.actions.submit", "Canviar contrasenya")}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  className="min-h-[44px] w-full sm:w-auto"
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