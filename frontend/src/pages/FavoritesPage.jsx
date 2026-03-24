import Header from "@/components/Header"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Link, useNavigate } from "react-router-dom"
import { useAuth } from "@/context/auth-context"
import { useFavorites } from "@/context/favorites-context"
import { Heart, ArrowLeft, HeartHandshake, User } from "lucide-react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

export default function FavoritesPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { isLoggedIn, user } = useAuth()
  const { favorites, loading, toggleFavorite } = useFavorites()

  const formatPrice = (value) => {
    if (value === null || value === undefined) return "—"

    const n = Number(value)
    if (Number.isNaN(n)) return "—"

    return `${n.toFixed(2)}€`
  }

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto max-w-3xl px-4 py-10">
          <Card className="rounded-2xl border shadow-sm">
            <CardContent className="p-6">
              <p className="mb-4 text-muted-foreground">
                {t("favorites.notLoggedIn", "Has d’iniciar sessió per veure els teus favorits.")}
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

      <main className="container mx-auto max-w-6xl px-4 py-10">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">
              {t("profile.sections.favorites", "Favorits")}
            </p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">
              {t("favorites.title", "Els meus favorits")}
            </h1>
          </div>

          <Button variant="outline" onClick={() => navigate("/profile")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t("favorites.backToProfile", "Tornar al perfil")}
          </Button>
        </div>

        <div className="mb-6">
          <Card className="rounded-3xl border shadow-sm">
            <CardContent className="p-6 md:p-8">
              <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
                <div className="flex items-start gap-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
                    <HeartHandshake className="h-7 w-7" />
                  </div>

                  <div>
                    <h2 className="text-xl font-semibold">
                      {t("favorites.title", "Els meus favorits")}
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {t(
                        "favorites.subtitle",
                        "Consulta i gestiona els productes que has guardat per més endavant."
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 rounded-2xl bg-muted/50 px-4 py-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-background">
                    <User className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {user?.name || user?.email}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {user?.email}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {loading ? (
          <Card className="rounded-2xl border shadow-sm">
            <CardContent className="p-6">
              <p className="text-muted-foreground">
                {t("favorites.loading", "Carregant favorits...")}
              </p>
            </CardContent>
          </Card>
        ) : favorites.length === 0 ? (
          <Card className="rounded-2xl border shadow-sm">
            <CardContent className="p-6">
              <p className="text-muted-foreground">
                {t("favorites.empty", "Encara no tens cap producte preferit.")}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {favorites.map((product) => {
              const productId = product?.id
              const productName =
                typeof product?.name === "string" && product.name.trim() !== ""
                  ? product.name
                  : t("favorites.unnamedProduct", "Producte")

              const productBrand =
                typeof product?.brand === "string" && product.brand.trim() !== ""
                  ? product.brand
                  : null

              const productThumbnail =
                typeof product?.thumbnail === "string" && product.thumbnail.trim() !== ""
                  ? product.thumbnail
                  : null

              return (
                <Card
                  key={productId}
                  className="group rounded-3xl border shadow-sm transition-all hover:shadow-md"
                >
                  <CardContent className="p-4">
                    <div
                      className="cursor-pointer"
                      onClick={() => navigate(`/products/${productId}`)}
                    >
                      <div className="aspect-square overflow-hidden rounded-2xl bg-muted/30">
                        {productThumbnail ? (
                          <img
                            src={productThumbnail}
                            alt={productName}
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
                            {t("favorites.noImage", "Sense imatge")}
                          </div>
                        )}
                      </div>

                      <div className="mt-4 space-y-1">
                        {productBrand ? (
                          <p className="text-xs text-muted-foreground">{productBrand}</p>
                        ) : null}

                        <p className="font-medium leading-snug text-foreground">
                          {productName}
                        </p>

                        <p className="text-sm text-muted-foreground">
                          {formatPrice(product?.price)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 flex gap-2">
                      <Button
                        className="flex-1"
                        onClick={() => navigate(`/products/${productId}`)}
                      >
                        {t("favorites.viewProduct", "Veure producte")}
                      </Button>

                      <Button
                        variant="outline"
                        size="icon"
                        onClick={async () => {
                          try {
                            await toggleFavorite(productId)
                            toast.success(
                              t("favorites.removed", "Producte eliminat de favorits")
                            )
                          } catch (e) {
                            console.error("Error removing favorite:", e)
                            toast.error(
                              t(
                                "favorites.removeError",
                                "No s'ha pogut eliminar dels favorits"
                              )
                            )
                          }
                        }}
                        aria-label={t("favorites.remove", "Eliminar de favorits")}
                      >
                        <Heart className="h-4 w-4 fill-current" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}