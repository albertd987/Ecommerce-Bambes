import { useState } from "react"
import Header from "@/components/Header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Link } from "react-router-dom"
import { forgotPassword } from "@/services/api"
import { useTranslation } from "react-i18next"

export default function ForgotPasswordPage() {
  const { t } = useTranslation()
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [successMsg, setSuccessMsg] = useState("")
  const [errorMsg, setErrorMsg] = useState("")

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setSuccessMsg("")
    setErrorMsg("")

    try {
      const res = await forgotPassword(email)
      setSuccessMsg(
        
          t(
            "forgotPassword.success",
            "Si el correu existeix, t’hem enviat un enllaç per restablir la contrasenya."
          )
      )
      setEmail("")
    } catch (err) {
      setErrorMsg(
        
          t("forgotPassword.error", "No s’ha pogut enviar el correu.")
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
            <CardTitle>
              {t("forgotPassword.title", "Recuperar contrasenya")}
            </CardTitle>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {t(
                  "forgotPassword.description",
                  "Escriu el teu correu i t’enviarem un enllaç per restablir la contrasenya."
                )}
              </p>

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
                <label htmlFor="email" className="text-sm font-medium">
                  {t("forgotPassword.email", "Correu electrònic")}
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  className="w-full border rounded-md px-3 py-2 bg-background"
                  placeholder={t("forgotPassword.placeholder", "tu@exemple.com")}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <Button className="w-full" size="lg" disabled={loading}>
                {loading
                  ? t("forgotPassword.loading", "Enviant...")
                  : t("forgotPassword.submit", "Enviar enllaç")}
              </Button>

              <p className="text-sm text-muted-foreground">
                <Link to="/login" className="underline">
                  {t("forgotPassword.backToLogin", "Tornar a iniciar sessió")}
                </Link>
              </p>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}