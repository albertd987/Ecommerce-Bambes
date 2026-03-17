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

      <main className="max-w-[1320px] mx-auto px-6 py-6">
        <div className="flex items-center justify-between mb-6 gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {t("favorites.title", "Els meus favorits")}
            </h1>
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
          <div className="border rounded-lg p-6">
            <p className="text-muted-foreground">
              {t("favorites.loading", "Carregant favorits...")}
            </p>
          </div>
        ) : favorites.length === 0 ? (
          <div className="border rounded-lg p-6">
            <p className="text-muted-foreground">
              {t("favorites.empty", "Encara no tens cap producte preferit.")}
            </p>
          </div>
        ) : (
          <div className="grid gap-x-5 gap-y-10 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
                <div key={productId} className="group">
                  <div
                    className="cursor-pointer"
                    onClick={() => navigate(`/products/${productId}`)}
                  >
                    <div className="aspect-square overflow-hidden rounded-lg bg-muted/30">
                      {productThumbnail ? (
                        <img
                          src={productThumbnail}
                          alt={productName}
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                        />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center text-sm text-muted-foreground">
                          {t("favorites.noImage", "Sense imatge")}
                        </div>
                      )}
                    </div>

                    <div className="mt-3 space-y-1">
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

                  <div className="mt-3 flex gap-2">
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
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}