import { useEffect, useState } from "react"
import Header from "@/components/Header"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { useAuth } from "@/context/auth-context"
import { useNavigate, Link } from "react-router-dom"
import { toast } from "sonner"
import api from "@/services/api"
import { useTranslation } from "react-i18next"
import { ArrowLeft, PencilLine, User } from "lucide-react"

function InputField({
  label,
  value,
  onChange,
  placeholder = "",
  type = "text",
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-foreground">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full rounded-xl border bg-background px-4 py-3 text-sm outline-none transition-colors focus:border-foreground"
      />
    </div>
  )
}

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
        <main className="container mx-auto max-w-2xl px-4 py-10">
          <Card className="rounded-2xl border shadow-sm">
            <CardContent className="p-6">
              <p className="mb-4 text-muted-foreground">
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

      <main className="container mx-auto max-w-4xl px-4 py-10">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">
              {t("profile.title", "El meu perfil")}
            </p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">
              {t("profileEdit.title", "Editar perfil")}
            </h1>
          </div>

          <Button variant="outline" onClick={() => navigate("/profile")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t("profileEdit.actions.back", "Tornar al perfil")}
          </Button>
        </div>

        <Card className="rounded-3xl border shadow-sm">
          <CardContent className="p-6 md:p-8">
            <div className="mb-8 flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
              <div className="flex items-start gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
                  <PencilLine className="h-7 w-7" />
                </div>

                <div>
                  <h2 className="text-xl font-semibold">
                    {t("profileEdit.form.title", "Dades personals")}
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t(
                      "profileEdit.subtitle",
                      "Actualitza la informació principal del teu compte."
                    )}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-2xl bg-muted/50 px-4 py-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-background">
                  <User className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{user?.name || "—"}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {user?.email || "—"}
                  </p>
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid gap-5 md:grid-cols-2">
                <InputField
                  label={t("profile.fields.name", "Nom")}
                  value={form.name}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, name: e.target.value }))
                  }
                  placeholder={t("profileEdit.placeholders.name", "El teu nom")}
                />

                <InputField
                  label={t("profile.fields.phone", "Telèfon")}
                  value={form.phone}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, phone: e.target.value }))
                  }
                  placeholder={t("profileEdit.placeholders.phone", "+34 612 345 678")}
                />
              </div>

              <InputField
                label={t("profile.fields.email", "Email")}
                type="email"
                value={form.email}
                onChange={(e) =>
                  setForm((p) => ({ ...p, email: e.target.value }))
                }
                placeholder={t("profileEdit.placeholders.email", "tu@exemple.com")}
              />

              <div className="flex flex-col gap-3 pt-4 sm:flex-row">
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