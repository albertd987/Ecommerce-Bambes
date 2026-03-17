import { useState } from "react"
import Header from "@/components/Header"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/context/auth-context"
import { Link } from "react-router-dom"
import { changePassword } from "@/services/api"
import { useTranslation } from "react-i18next"

export default function ChangePasswordPage() {
  const { t } = useTranslation()
  const { isLoggedIn } = useAuth()

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
        <main className="container mx-auto px-4 py-10 max-w-3xl">
          <p className="text-muted-foreground mb-3">
            {t(
              "changePassword.notLoggedIn",
              "No has iniciat sessió. Entra per canviar la teva contrasenya."
            )}
          </p>
          <Link to="/login">
            <Button>{t("auth.login.title", "Iniciar sessió")}</Button>
          </Link>
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

    // ✅ Validació frontend mínima
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

      <main className="container mx-auto px-4 py-10 max-w-3xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">
            {t("changePassword.title", "Canviar contrasenya")}
          </h2>

          <Link to="/profile">
            <Button variant="outline">
              {t("changePassword.backToProfile", "Tornar al perfil")}
            </Button>
          </Link>
        </div>

        <p className="text-sm text-muted-foreground mb-6">
          {t(
            "changePassword.description",
            "Introdueix la contrasenya actual i la nova contrasenya."
          )}
        </p>

        {successMsg && (
          <div className="mb-4 border rounded-lg p-3 text-sm">✅ {successMsg}</div>
        )}

        {errorMsg && (
          <div className="mb-4 border rounded-lg p-3 text-sm text-destructive">
            {errorMsg}
          </div>
        )}

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">
              {t("changePassword.fields.current.label", "Contrasenya actual")}
            </label>
            <input
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              type="password"
              className="w-full rounded-md border px-3 py-2 focus:ring focus:ring-primary/50"
              placeholder={t(
                "changePassword.fields.current.placeholder",
                "Introdueix la teva contrasenya actual"
              )}
              autoComplete="current-password"
            />
            {fieldErrors?.current_password?.length ? (
              <p className="text-xs text-destructive mt-1">
                {fieldErrors.current_password[0]}
              </p>
            ) : null}
          </div>

          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">
              {t("changePassword.fields.new.label", "Nova contrasenya")}
            </label>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              className="w-full rounded-md border px-3 py-2 focus:ring focus:ring-primary/50"
              placeholder={t(
                "changePassword.fields.new.placeholder",
                "Introdueix la teva nova contrasenya"
              )}
              autoComplete="new-password"
            />
            {fieldErrors?.password?.length ? (
              <p className="text-xs text-destructive mt-1">
                {fieldErrors.password[0]}
              </p>
            ) : null}
          </div>

          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">
              {t(
                "changePassword.fields.confirm.label",
                "Confirma la nova contrasenya"
              )}
            </label>
            <input
              value={passwordConfirmation}
              onChange={(e) => setPasswordConfirmation(e.target.value)}
              type="password"
              className="w-full rounded-md border px-3 py-2 focus:ring focus:ring-primary/50"
              placeholder={t(
                "changePassword.fields.confirm.placeholder",
                "Confirma la teva nova contrasenya"
              )}
              autoComplete="new-password"
            />
            {fieldErrors?.password_confirmation?.length ? (
              <p className="text-xs text-destructive mt-1">
                {fieldErrors.password_confirmation[0]}
              </p>
            ) : null}
          </div>

          <Button type="submit" disabled={loading}>
            {loading
              ? t("changePassword.actions.changing", "Canviant...")
              : t("changePassword.actions.submit", "Canviar contrasenya")}
          </Button>
        </form>
      </main>
    </div>
  )
}