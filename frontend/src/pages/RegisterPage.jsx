import { useState } from "react"
import Header from "@/components/Header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Link, useNavigate } from "react-router-dom"
import { useAuth } from "@/context/auth-context"
import { useTranslation } from "react-i18next"

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

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))

    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: null }))
    }
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    setErrors({})
    setLoading(true)

    const result = await register(
      formData.name,
      formData.email,
      formData.password,
      formData.passwordConfirmation
    )

    setLoading(false)

    if (result.success) {
      // ✅ En lloc d'anar a /profile, anem a verificar email
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
            <form onSubmit={onSubmit} className="space-y-3">
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

              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium">
                  {t("register.password", "Contrasenya")}
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  className="w-full border rounded-md px-3 py-2 bg-background"
                  placeholder={t("register.placeholders.password", "Mínim 8 caràcters")}
                  value={formData.password}
                  onChange={handleChange}
                />
                {errors.password && (
                  <p className="text-sm text-red-600 dark:text-red-400">
                    {errors.password[0]}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <label htmlFor="passwordConfirmation" className="text-sm font-medium">
                  {t("register.passwordConfirm", "Confirmar contrasenya")}
                </label>
                <input
                  id="passwordConfirmation"
                  name="passwordConfirmation"
                  type="password"
                  required
                  className="w-full border rounded-md px-3 py-2 bg-background"
                  placeholder={t("register.placeholders.passwordConfirm", "Repeteix la contrasenya")}
                  value={formData.passwordConfirmation}
                  onChange={handleChange}
                />
              </div>

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