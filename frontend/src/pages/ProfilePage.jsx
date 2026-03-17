import Header from "@/components/Header"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/context/auth-context"
import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"

export default function ProfilePage() {
  const { t } = useTranslation()
  const { isLoggedIn, user } = useAuth()

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto px-4 py-10 max-w-3xl">
        <h2 className="text-2xl font-bold mb-6">
          {t("profile.title", "El meu perfil")}
        </h2>

        {isLoggedIn ? (
          <div className="space-y-6">

            {/* DADES PERSONALS */}
            <div className="border rounded-lg p-4">
              <h3 className="font-semibold mb-3">
                {t("profile.sections.personal", "Dades personals")}
              </h3>

              <div className="space-y-2 text-sm">
                <div>
                  <p className="text-muted-foreground">
                    {t("profile.fields.name", "Nom")}
                  </p>
                  <p className="font-medium">
                    {user?.name || t("profile.placeholders.namePending", "— pendent de backend —")}
                  </p>
                </div>

                <div>
                  <p className="text-muted-foreground">
                    {t("profile.fields.email", "Email")}
                  </p>
                  <p className="font-medium">{user?.email}</p>
                </div>
              </div>
            </div>

            {/* SEGURETAT */}
            <div className="border rounded-lg p-4">
              <h3 className="font-semibold mb-3">
                {t("profile.sections.security", "Seguretat")}
              </h3>

              <p className="text-sm text-muted-foreground mb-3">
                {t(
                  "profile.security.description",
                  "Pots canviar la teva contrasenya o gestionar la seguretat del compte."
                )}
              </p>

              <Link to="/change-password">
                <Button variant="outline">
                  {t("profile.security.changePassword", "Canviar contrasenya")}
                </Button>
              </Link>
            </div>

            {/* COMANDES */}
            <div className="border rounded-lg p-4">
              <h3 className="font-semibold mb-3">
                {t("profile.sections.orders", "Comandes")}
              </h3>

              <p className="text-sm text-muted-foreground mb-3">
                {t("profile.orders.description", "Consulta les teves comandes realitzades.")}
              </p>

              <Link to="/orders">
                <Button variant="outline">
                  {t("profile.orders.view", "Veure comandes")}
                </Button>
              </Link>
            </div>

            {/* FAVORITS */}
            <div className="border rounded-lg p-4">
              <h3 className="font-semibold mb-3">
                {t("profile.sections.favorites", "Favorits")}
              </h3>

              <p className="text-sm text-muted-foreground mb-3">
                {t("profile.favorites.description", "Consulta els productes que has guardat com a favorits.")}
              </p>

              <Link to="/favorites">
                <Button variant="outline">
                  {t("profile.favorites.view", "Veure favorits")}
                </Button>
              </Link>
            </div>

            {/* INFO */}
            <p className="text-xs text-muted-foreground">
              {t(
                "profile.note",
                "* Aquesta pàgina és una maqueta. Quan connectem el backend, aquestes dades vindran de la base de dades."
              )}
            </p>

          </div>
        ) : (
          <div className="border rounded-lg p-4 max-w-md">
            <p className="text-muted-foreground mb-3">
              {t(
                "profile.loggedOut.message",
                "No has iniciat sessió. Entra per veure el teu perfil."
              )}
            </p>

            <Link to="/login">
              <Button>{t("auth.login", "Iniciar sessió")}</Button>
            </Link>
          </div>
        )}
      </main>
    </div>
  )
}