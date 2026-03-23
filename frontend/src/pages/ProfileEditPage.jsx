import { useEffect, useState } from "react"
import Header from "@/components/Header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useAuth } from "@/context/auth-context"
import { useNavigate, Link } from "react-router-dom"
import { toast } from "sonner"
import api from "@/services/api"
import { useTranslation } from "react-i18next"

export default function ProfileEditPage() {
  const { t } = useTranslation()
  const { user, isLoggedIn, updateUser } = useAuth()
  const navigate = useNavigate()

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
  })

  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!user) return

    setForm({
      name: user.name || "",
      email: user.email || "",
      phone: user.phone || "",
    })
  }, [user])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      const res = await api.put("/user/profile", form)
      const updatedUser = res?.data?.data

      if (updatedUser) {
        updateUser(updatedUser)
        setForm({
          name: updatedUser.name || "",
          email: updatedUser.email || "",
          phone: updatedUser.phone || "",
        })
      }

      toast.success(
        t("profileEdit.toasts.success", "Dades actualitzades correctament")
      )
    } catch (e) {
      console.error("Error updating profile:", e)
      toast.error(
        e?.response?.data?.message ||
          t("profileEdit.toasts.error", "Error actualitzant dades")
      )
    } finally {
      setLoading(false)
    }
  }

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-10 max-w-2xl">
          <Card>
            <CardContent className="p-6">
              <p className="text-muted-foreground mb-4">
                {t(
                  "profile.loggedOut.message",
                  "No has iniciat sessió. Entra per veure el teu perfil."
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

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto px-4 py-10 max-w-2xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">
            {t("profileEdit.title", "Editar perfil")}
          </h2>

          <Button variant="outline" onClick={() => navigate("/profile")}>
            {t("profileEdit.actions.back", "Tornar al perfil")}
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>
              {t("profileEdit.form.title", "Dades personals")}
            </CardTitle>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  {t("profile.fields.name", "Nom")}
                </label>
                <input
                  value={form.name}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, name: e.target.value }))
                  }
                  className="w-full rounded-md border px-3 py-2 bg-background"
                  placeholder={t("profileEdit.placeholders.name", "El teu nom")}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  {t("profile.fields.email", "Email")}
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, email: e.target.value }))
                  }
                  className="w-full rounded-md border px-3 py-2 bg-background"
                  placeholder={t("profileEdit.placeholders.email", "tu@exemple.com")}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  {t("profile.fields.phone", "Telèfon")}
                </label>
                <input
                  value={form.phone}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, phone: e.target.value }))
                  }
                  className="w-full rounded-md border px-3 py-2 bg-background"
                  placeholder={t("profileEdit.placeholders.phone", "+34 612 345 678")}
                />
              </div>

              <div className="flex gap-2 pt-2">
                <Button type="submit" disabled={loading}>
                  {loading
                    ? t("profileEdit.actions.saving", "Desant...")
                    : t("profileEdit.actions.save", "Guardar canvis")}
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