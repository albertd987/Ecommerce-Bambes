import { useState } from "react"
import Header from "@/components/Header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Link, useNavigate } from "react-router-dom"
import { useAuth } from "@/context/auth-context"
import { useTranslation } from "react-i18next"

export default function LoginPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { login } = useAuth()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const onSubmit = async (e) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    const result = await login(email, password)

    setLoading(false)

    if (result.success) {
      navigate("/profile")
    } else {
      setError(result.error)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto px-4 py-10 max-w-lg">
        <Card>
          <CardHeader>
            <CardTitle>
              {t("login.title", "Iniciar sessió")}
            </CardTitle>
          </CardHeader>

          <CardContent>
            <form onSubmit={onSubmit} className="space-y-3">
              {error && (
                <div className="rounded-md bg-red-50 dark:bg-red-900/20 p-3 border border-red-200 dark:border-red-800">
                  <p className="text-sm text-red-800 dark:text-red-200">
                    {error}
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium">
                  {t("login.email", "Correu electrònic")}
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  className="w-full border rounded-md px-3 py-2 bg-background"
                  placeholder={t("login.placeholders.email", "tu@exemple.com")}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium">
                  {t("login.password", "Contrasenya")}
                </label>
                <input
                  id="password"
                  type="password"
                  required
                  className="w-full border rounded-md px-3 py-2 bg-background"
                  placeholder={t("login.placeholders.password", "Contrasenya")}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              <Button
                className="w-full"
                size="lg"
                disabled={loading || !email || !password}
              >
                {loading
                  ? t("login.loading", "Carregant...")
                  : t("login.submit", "Entrar")}
              </Button>

              <p className="text-sm text-muted-foreground">
                {t("login.noAccount", "No tens compte?")}{" "}
                <Link to="/register" className="underline">
                  {t("login.register", "Registra't")}
                </Link>
              </p>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}