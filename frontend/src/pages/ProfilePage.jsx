import Header from "@/components/Header"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/context/auth-context"
import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import {
  CheckCircle2,
  Heart,
  MailCheck,
  MapPin,
  Package,
  Shield,
  User,
} from "lucide-react"

function ProfileActionCard({ icon, title, description, to, actionLabel }) {
  const Icon = icon

  return (
    <div className="rounded-2xl border bg-card p-5 shadow-sm transition-all hover:shadow-md">
      <div className="flex items-start gap-4">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted">
          <Icon className="h-5 w-5" />
        </div>

        <div className="flex-1">
          <h3 className="font-semibold text-foreground">{title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>

          <div className="mt-4">
            <Link to={to}>
              <Button variant="outline">{actionLabel}</Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

function InfoRow({ label, value, children }) {
  return (
    <div className="rounded-xl bg-muted/40 px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      {children ? (
        <div className="mt-1">{children}</div>
      ) : (
        <p className="mt-1 font-medium text-foreground">{value || "—"}</p>
      )}
    </div>
  )
}

export default function ProfilePage() {
  const { t } = useTranslation()
  const { isLoggedIn, user } = useAuth()

  const isVerified = !!user?.email_verified_at

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto max-w-5xl px-4 py-10">
        <div className="mb-8">
          <p className="text-sm text-muted-foreground">
            {t("profile.title", "El meu perfil")}
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">
            {user?.name || t("profile.title", "El meu perfil")}
          </h1>
        </div>

        {isLoggedIn ? (
          <div className="space-y-8">
            <section className="rounded-3xl border bg-card p-6 shadow-sm">
              <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
                <div className="flex items-start gap-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
                    <User className="h-7 w-7" />
                  </div>

                  <div>
                    <h2 className="text-xl font-semibold">
                      {t("profile.sections.personal", "Dades personals")}
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {t(
                        "profile.personal.subtitle",
                        "Gestiona la informació principal del teu compte."
                      )}
                    </p>
                  </div>
                </div>

                <Link to="/profile/edit">
                  <Button>{t("profile.actions.edit", "Editar")}</Button>
                </Link>
              </div>

              <div className="mt-6 grid gap-3 md:grid-cols-4">
                <InfoRow
                  label={t("profile.fields.name", "Nom")}
                  value={user?.name}
                />
                <InfoRow
                  label={t("profile.fields.email", "Email")}
                  value={user?.email}
                />
                <InfoRow
                  label={t("profile.fields.phone", "Telèfon")}
                  value={user?.phone}
                />
                <InfoRow label={t("profile.fields.verification", "Verificació")}>
                  {isVerified ? (
                    <div className="flex items-center gap-2 text-green-600">
                      <CheckCircle2 className="h-4 w-4" />
                      <span className="font-medium">
                        {t("profile.verification.verified", "Email verificat")}
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-amber-600">
                      <MailCheck className="h-4 w-4" />
                      <span className="font-medium">
                        {t("profile.verification.pending", "Pendent de verificar")}
                      </span>
                    </div>
                  )}
                </InfoRow>
              </div>
            </section>

            <section>
              <div className="grid gap-4 md:grid-cols-2">
                <ProfileActionCard
                  icon={Shield}
                  title={t("profile.sections.security", "Seguretat")}
                  description={t(
                    "profile.security.description",
                    "Pots canviar la teva contrasenya o gestionar la seguretat del compte."
                  )}
                  to="/change-password"
                  actionLabel={t("profile.security.changePassword", "Canviar contrasenya")}
                />



                <ProfileActionCard
                  icon={Package}
                  title={t("profile.sections.orders", "Comandes")}
                  description={t(
                    "profile.orders.description",
                    "Consulta les teves comandes realitzades."
                  )}
                  to="/orders"
                  actionLabel={t("profile.orders.view", "Veure comandes")}
                />

                <ProfileActionCard
                  icon={Heart}
                  title={t("profile.sections.favorites", "Favorits")}
                  description={t(
                    "profile.favorites.description",
                    "Consulta els productes que has guardat com a favorits."
                  )}
                  to="/favorites"
                  actionLabel={t("profile.favorites.view", "Veure favorits")}
                />

                <ProfileActionCard
                  icon={MapPin}
                  title={t("profile.sections.addresses", "Direccions")}
                  description={t(
                    "profile.addresses.description",
                    "Gestiona les teves direccions guardades per agilitzar futures compres."
                  )}
                  to="/addresses"
                  actionLabel={t("profile.addresses.view", "Gestionar direccions")}
                />

                                <ProfileActionCard
                  icon={MailCheck}
                  title={t("profile.sections.verification", "Verificació")}
                  description={
                    isVerified
                      ? t(
                          "profile.verification.descriptionVerified",
                          "El teu correu electrònic ja està verificat."
                        )
                      : t(
                          "profile.verification.descriptionPending",
                          "Verifica el teu correu electrònic per activar completament el compte."
                        )
                  }
                  to="/verify-email"
                  actionLabel={
                    isVerified
                      ? t("profile.verification.view", "Veure verificació")
                      : t("profile.verification.verify", "Verificar correu")
                  }
                />
              </div>
            </section>


          </div>
        ) : (
          <div className="max-w-md rounded-2xl border bg-card p-6 shadow-sm">
            <h2 className="text-lg font-semibold">
              {t("profile.loggedOut.title", "Sessió no iniciada")}
            </h2>

            <p className="mt-2 text-sm text-muted-foreground">
              {t(
                "profile.loggedOut.message",
                "No has iniciat sessió. Entra per veure el teu perfil."
              )}
            </p>

            <div className="mt-5">
              <Link to="/login">
                <Button>{t("auth.login", "Iniciar sessió")}</Button>
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}