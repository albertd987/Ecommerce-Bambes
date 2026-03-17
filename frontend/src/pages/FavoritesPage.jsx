import Header from "@/components/Header"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Link, useNavigate } from "react-router-dom"
import { useAuth } from "@/context/auth-context"
import { useFavorites } from "@/context/favorites-context"
import { Heart } from "lucide-react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

export default function FavoritesPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { isLoggedIn, user } = useAuth()
  const { favorites, loading, toggleFavorite } = useFavorites()

  const money = (value) => {
    if (value === null || value === undefined) return "—"

    if (typeof value === "number") {
      return `${Number(value).toFixed(2)}€`
    }

    if (typeof value === "string") {
      const n = Number(value)
      return Number.isNaN(n) ? "—" : `${n.toFixed(2)}€`
    }

    if (typeof value === "object") {
      if ("formatted" in value) return value.formatted
      if ("value" in value) {
        const n = Number(value.value)
        return Number.isNaN(n) ? "—" : `${n.toFixed(2)}€`
      }
      if ("amount" in value) {
        const n = Number(value.amount)
        return Number.isNaN(n) ? "—" : `${n.toFixed(2)}€`
      }
    }

    return "—"
  }

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-10 max-w-5xl">
          <Card>
            <CardContent className="p-6">
              <p className="text-muted-foreground mb-4">
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

      <main className="container mx-auto px-4 py-10 max-w-5xl">
        <div className="flex items-center justify-between mb-6 gap-3">
          <div>
            <h2 className="text-2xl font-bold">
              {t("favorites.title", "Els meus favorits")}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {t("favorites.signedInAs", "Sessió iniciada com")}: {user?.name || user?.email}
            </p>
          </div>

          <Link to="/profile">
            <Button variant="outline">
              {t("favorites.backToProfile", "Tornar al perfil")}
            </Button>
          </Link>
        </div>

        {loading ? (
          <Card>
            <CardContent className="p-6">
              <p className="text-muted-foreground">
                {t("favorites.loading", "Carregant favorits...")}
              </p>
            </CardContent>
          </Card>
        ) : favorites.length === 0 ? (
          <Card>
            <CardContent className="p-6">
              <p className="text-muted-foreground">
                {t("favorites.empty", "Encara no tens cap producte preferit.")}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {favorites.map((product) => {
              const productId = product?.id
              const productName =
                product?.name ||
                product?.attribute_data?.name?.value ||
                t("favorites.unnamedProduct", "Producte")

              const productThumbnail =
                product?.thumbnail ||
                product?.image ||
                null

              const productBrand =
                typeof product?.brand === "string"
                  ? product.brand
                  : product?.brand?.name || null

              const productPrice = product?.price

              return (
                <Card key={productId} className="overflow-hidden">
                  <div className="aspect-square bg-muted/30 overflow-hidden">
                    {productThumbnail ? (
                      <img
                        src={productThumbnail}
                        alt={String(productName)}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center text-sm text-muted-foreground">
                        {t("favorites.noImage", "Sense imatge")}
                      </div>
                    )}
                  </div>

                  <CardContent className="p-4 space-y-3">
                    {productBrand ? (
                      <p className="text-xs text-muted-foreground">{productBrand}</p>
                    ) : null}

                    <div>
                      <p className="font-semibold leading-snug">{String(productName)}</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {money(productPrice)}
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        className="flex-1"
                        onClick={() => {
                          if (!productId) return
                          navigate(`/products/${productId}`)
                        }}
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