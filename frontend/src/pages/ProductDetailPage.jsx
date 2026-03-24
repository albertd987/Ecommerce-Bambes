// src/pages/ProductDetailPage.jsx
import { useEffect, useMemo, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import Header from "@/components/Header"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { useCart } from "@/context/cart-context"
import api from "@/services/api"
import { organizeVariants, findVariant, organizeColors, findColorVariant } from "@/utils/variantParser"
import { ChevronLeft, ChevronRight, Heart } from "lucide-react"
import { toast } from "sonner"
import { useTranslation } from "react-i18next"
import { useFavorites } from "@/context/favorites-context"
import { useAuth } from "@/context/auth-context"

function getSafeText(value, fallback = "") {
  if (value == null) return fallback
  if (typeof value === "string") return value
  if (typeof value === "number") return String(value)

  if (typeof value === "object") {
    if (typeof value.name === "string") return value.name
    if (typeof value.value === "string") return value.value
    if (typeof value.label === "string") return value.label
    if (typeof value.text === "string") return value.text
    if (typeof value.title === "string") return value.title
  }

  return fallback
}

function getSafePrice(value) {
  if (value == null) return 0
  if (typeof value === "number") return value
  if (typeof value === "string") {
    const n = Number(value)
    return Number.isNaN(n) ? 0 : n
  }

  if (typeof value === "object") {
    if (typeof value.decimal === "number") return value.decimal
    if (typeof value.value === "number") return value.value
    if (typeof value.amount === "number") return value.amount
    if (typeof value.price === "number") return value.price
  }

  return 0
}

function getSafeImage(value) {
  if (!value) return null
  if (typeof value === "string") return value

  if (typeof value === "object") {
    if (typeof value.url === "string") return value.url
    if (typeof value.src === "string") return value.src
    if (typeof value.path === "string") return value.path
    if (typeof value.original_url === "string") return value.original_url
  }

  return null
}

function translateColor(color, t, scope = "productDetail") {
  if (!color) return ""
  const key = String(color).trim().toUpperCase()
  return t(`${scope}.colors.${key}`, color)
}

export default function ProductDetailPage() {
  const { t } = useTranslation()
  const { id } = useParams()
  const navigate = useNavigate()
  const { addItem } = useCart()
  const { isLoggedIn } = useAuth()
  const { isFavorite, toggleFavorite } = useFavorites()

  const [product, setProduct] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [selectedSize, setSelectedSize] = useState(null)
  const [selectedColor, setSelectedColor] = useState(null)
  const [addingToCart, setAddingToCart] = useState(false)
  const [togglingFavorite, setTogglingFavorite] = useState(false)
  const [selectedImageIndex, setSelectedImageIndex] = useState(0)

  const [variantsData, setVariantsData] = useState(null)

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        setLoading(true)
        const response = await api.get(`/products/${id}`)
        const productData = response.data?.data ?? response.data

        setProduct(productData)

        // Use new colors structure if available, fall back to legacy variants
        if (productData?.colors?.length > 0) {
          const organized = organizeColors(productData.colors)
          setVariantsData({ ...organized, isNewFormat: true })
          setSelectedColor(organized.colorNames[0] ?? null)
        } else if (productData?.variants?.length > 0) {
          const organized = organizeVariants(productData.variants)
          setVariantsData(organized)
          if (organized.colors.length > 0) {
            setSelectedColor(organized.colors[0])
          }
        }

        setError(null)
      } catch (err) {
        console.error("Error loading product:", err)
        setError(t("productDetail.errors.load", "Error carregant el producte"))
      } finally {
        setLoading(false)
      }
    }

    fetchProduct()
  }, [id, t])

  // Reset image gallery to first image when color changes
  useEffect(() => {
    setSelectedImageIndex(0)
  }, [selectedColor])

  const productName = useMemo(
    () => getSafeText(product?.name, "Producte"),
    [product]
  )

  const productDescription = useMemo(
    () => getSafeText(product?.description, ""),
    [product]
  )

  const brandName = useMemo(
    () => getSafeText(product?.brand, ""),
    [product]
  )

  const productPrice = useMemo(
    () => getSafePrice(product?.price),
    [product]
  )

  const allImages = useMemo(() => {
    if (!product) return []

    // New format: images come from the selected color
    if (variantsData?.isNewFormat && selectedColor && variantsData.imagesByColor) {
      const colorImages = variantsData.imagesByColor[selectedColor] ?? []
      if (colorImages.length > 0) {
        return colorImages.filter(Boolean)
      }
    }

    // Legacy fallback: product-level thumbnail + images
    const thumb = getSafeImage(product.thumbnail)
    const rest  = Array.isArray(product.images)
      ? product.images.map(getSafeImage).filter(Boolean)
      : []
    return [thumb, ...rest.filter((img) => img !== thumb)].filter(Boolean)
  }, [product, variantsData, selectedColor])

  const handleAddToCart = async () => {
    if (!selectedSize || !selectedColor) {
      toast.warning(t("productDetail.toasts.selectSize", "Selecciona una talla"))
      return
    }

    const variant = variantsData?.isNewFormat
      ? findColorVariant(variantsData?.variantMap, selectedColor, selectedSize)
      : findVariant(variantsData?.variantMap, selectedSize, selectedColor)

    if (!variant) {
      toast.error(t("productDetail.toasts.variantUnavailable", "Variant no disponible"))
      return
    }

    if (variant.stock_status === 'out_of_stock') {
      toast.error(t("productDetail.toasts.outOfStock", "No hi ha estoc disponible"))
      return
    }

    try {
      setAddingToCart(true)

      const result = await addItem(
        {
          variant_id: variant.id,
          size: selectedSize,
          color: selectedColor,
          sku: variant.sku,
        },
        1
      )

      if (result.success) {
        toast.success(t("productDetail.toasts.addedToCart", "Producte afegit a la cistella!"))
      } else {
        toast.error(t("productDetail.toasts.addToCartError", "Error en afegir al carret"))
      }
    } catch (err) {
      console.error("Error adding to cart:", err)
      toast.error(t("productDetail.toasts.addToCartError", "Error en afegir al carret"))
    } finally {
      setAddingToCart(false)
    }
  }

  const handleToggleFavorite = async () => {
    if (!product?.id) return

    if (!isLoggedIn) {
      toast.warning(
        t(
          "productDetail.toasts.loginRequiredForFavorites",
          "Has d'iniciar sessió per afegir favorits"
        )
      )
      navigate("/login")
      return
    }

    try {
      setTogglingFavorite(true)
      const next = await toggleFavorite(product.id)

      if (next) {
        toast.success(t("productDetail.toasts.addedToFavorites", "Afegit a favorits"))
      } else {
        toast.success(t("productDetail.toasts.removedFromFavorites", "Eliminat de favorits"))
      }
    } catch (err) {
      console.error("Error toggling favorite:", err)
      toast.error(
        t("productDetail.toasts.favoriteError", "Error gestionant els favorits")
      )
    } finally {
      setTogglingFavorite(false)
    }
  }

  const handlePrevImage = () => {
    setSelectedImageIndex((prev) => (prev === 0 ? allImages.length - 1 : prev - 1))
  }

  const handleNextImage = () => {
    setSelectedImageIndex((prev) => (prev === allImages.length - 1 ? 0 : prev + 1))
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <p className="text-center text-muted-foreground">
            {t("productDetail.loading", "Carregant producte...")}
          </p>
        </main>
      </div>
    )
  }

  if (error || !product) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-destructive mb-4">
                {error || t("productDetail.notFound", "Producte no trobat")}
              </p>
              <Button onClick={() => navigate("/")}>
                {t("productDetail.actions.backHome", "Tornar a l'inici")}
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    )
  }

  const currentVariant =
    selectedSize && selectedColor
      ? variantsData?.isNewFormat
        ? findColorVariant(variantsData?.variantMap, selectedColor, selectedSize)
        : findVariant(variantsData?.variantMap, selectedSize, selectedColor)
      : null

  const isOutOfStock = currentVariant && currentVariant.stock_status === 'out_of_stock'
  const favorite = product ? isFavorite(product.id) : false

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="max-w-[1200px] mx-auto px-4 py-6 lg:py-10">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px] xl:grid-cols-[minmax(0,1fr)_440px]">
          <div className="flex gap-3">
            {allImages.length > 1 && (
              <div className="hidden md:flex flex-col gap-2 w-[76px] shrink-0">
                {allImages.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedImageIndex(idx)}
                    className={`aspect-square rounded-md overflow-hidden bg-muted/50 border-2 transition-all ${
                      selectedImageIndex === idx
                        ? "border-foreground"
                        : "border-transparent hover:border-muted-foreground/40"
                    }`}
                    aria-label={t("productDetail.gallery.thumbnailAria", "Seleccionar imatge")}
                    type="button"
                  >
                    <img
                      src={img}
                      alt={t("productDetail.gallery.imageAlt", "{{name}} imatge {{index}}", {
                        name: productName,
                        index: idx + 1,
                      })}
                      className="h-full w-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}

            <div className="relative flex-1">
              <div className="aspect-square rounded-lg overflow-hidden bg-muted/40 flex items-center justify-center">
                {allImages.length > 0 ? (
                  <img
                    src={allImages[selectedImageIndex]}
                    alt={productName}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="text-center p-8">
                    <p className="text-muted-foreground">
                      {t("productDetail.noImage", "Sense imatge")}
                    </p>
                  </div>
                )}
              </div>

              {allImages.length > 1 && (
                <div className="flex items-center justify-center gap-3 mt-3">
                  <button
                    onClick={handlePrevImage}
                    className="w-9 h-9 rounded-full bg-muted/60 hover:bg-muted flex items-center justify-center transition-colors"
                    aria-label={t("productDetail.gallery.prev", "Imatge anterior")}
                    type="button"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    onClick={handleNextImage}
                    className="w-9 h-9 rounded-full bg-muted/60 hover:bg-muted flex items-center justify-center transition-colors"
                    aria-label={t("productDetail.gallery.next", "Imatge següent")}
                    type="button"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </div>
              )}

              {allImages.length > 1 && (
                <div className="flex md:hidden gap-2 mt-3 overflow-x-auto pb-1">
                  {allImages.map((img, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedImageIndex(idx)}
                      className={`w-16 h-16 shrink-0 rounded-md overflow-hidden bg-muted/50 border-2 transition-all ${
                        selectedImageIndex === idx ? "border-foreground" : "border-transparent"
                      }`}
                      aria-label={t("productDetail.gallery.thumbnailAria", "Seleccionar imatge")}
                      type="button"
                    >
                      <img
                        src={img}
                        alt={t("productDetail.gallery.imageAlt", "{{name}} imatge {{index}}", {
                          name: productName,
                          index: idx + 1,
                        })}
                        className="h-full w-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="lg:pt-0">
            {brandName && (
              <p className="text-sm font-medium text-orange-600 mb-1">{brandName}</p>
            )}

            <h1 className="text-2xl font-bold leading-tight">{productName}</h1>

            {productDescription && (
              <p className="text-muted-foreground mt-1 text-sm leading-snug">
                {productDescription}
              </p>
            )}

            <p className="text-xl font-medium mt-4">
              {Number(productPrice).toFixed(2)} &euro;
            </p>

            {variantsData && (variantsData.isNewFormat ? variantsData.colorNames : variantsData.colors).length > 1 && (
              <div className="mt-6">
                <p className="text-sm font-medium mb-3">
                  {t("productDetail.color.label", "Color")}:{" "}
                  <span>{translateColor(selectedColor, t, "productDetail")}</span>
                </p>
                <div className="flex gap-2 flex-wrap">
                  {(variantsData.isNewFormat ? variantsData.colorNames : variantsData.colors).map((color) => (
  <button
    key={color}
    onClick={() => setSelectedColor(color)}
    className={`px-4 py-2 rounded-full border text-sm transition-all ${
      selectedColor === color
        ? "border-foreground font-medium"
        : "border-border hover:border-muted-foreground"
    }`}
    aria-label={t(
      "productDetail.color.selectAria",
      "Seleccionar color {{color}}",
      {
        color: translateColor(color, t, "productDetail"),
      }
    )}
    type="button"
  >
    {translateColor(color, t, "productDetail")}
  </button>
))}
                </div>
              </div>
            )}

            {variantsData && (variantsData.isNewFormat ? (variantsData.sizesByColor[selectedColor] ?? []) : variantsData.sizes).length > 0 && (
              <div className="mt-6">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-base font-medium">
                    {t("productDetail.size.title", "Selecciona la teva talla")}
                  </p>
                  <button
                    type="button"
                    className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
                    onClick={() =>
                      toast.message(
                        t("productDetail.sizeGuide.todo", "Guia de talles (pendent)")
                      )
                    }
                  >
                    {t("productDetail.size.guide", "Guia de talles")}
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-[7px]">
                  {(variantsData.isNewFormat ? (variantsData.sizesByColor[selectedColor] ?? []) : variantsData.sizes).map((size) => {
                    const variant = variantsData?.isNewFormat
                      ? findColorVariant(variantsData.variantMap, selectedColor, size)
                      : findVariant(variantsData.variantMap, size, selectedColor)
                    const hasStock = variant && variant.stock_status !== 'out_of_stock'
                    const isSelected = selectedSize === size

                    return (
                      <button
                        key={size}
                        onClick={() => hasStock && setSelectedSize(size)}
                        disabled={!hasStock}
                        className={`h-12 rounded-md border text-sm transition-all
                          ${
                            isSelected
                              ? "border-foreground border-2 font-medium"
                              : hasStock
                              ? "border-border hover:border-foreground cursor-pointer"
                              : "border-border/50 text-muted-foreground/40 cursor-not-allowed line-through"
                          }`}
                        aria-label={t(
                          "productDetail.size.sizeAria",
                          "Seleccionar talla EU {{size}}",
                          { size }
                        )}
                        type="button"
                      >
                        EU {size}
                      </button>
                    )
                  })}
                </div>

                {selectedSize && currentVariant && (
                  <p className={`text-sm font-medium mt-2 ${
                    currentVariant.stock_status === 'in_stock' ? 'text-green-600' :
                    currentVariant.stock_status === 'low_stock' ? 'text-orange-500' :
                    'text-red-600'
                  }`}>
                    {t(`productDetail.stock.${currentVariant.stock_status}`)}
                  </p>
                )}
              </div>
            )}

            <div className="mt-8 space-y-3">
              <button
                onClick={handleAddToCart}
                disabled={!selectedSize || isOutOfStock || addingToCart}
                className="w-full h-14 rounded-full bg-foreground text-background font-medium text-base transition-opacity hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed"
                type="button"
              >
                {addingToCart
                  ? t("productDetail.actions.adding", "Afegint...")
                  : isOutOfStock
                  ? t("productDetail.actions.outOfStock", "Sense estoc")
                  : t("productDetail.actions.addToCart", "Afegir a la cistella")}
              </button>

              <button
                type="button"
                className="w-full h-14 rounded-full border-2 border-border font-medium text-base flex items-center justify-center gap-2 hover:border-foreground transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                onClick={handleToggleFavorite}
                disabled={togglingFavorite}
              >
                <Heart className={`h-5 w-5 ${favorite ? "fill-current" : ""}`} />
                {togglingFavorite
                  ? t("productDetail.actions.updatingFavorite", "Actualitzant favorits...")
                  : favorite
                  ? t("productDetail.actions.removeFromFavorites", "Eliminar de favorits")
                  : t("productDetail.actions.addToFavorites", "Afegir a favorits")}
              </button>
            </div>

            {currentVariant && (
              <p className="text-xs text-muted-foreground mt-6 pt-4 border-t">
                SKU: {currentVariant.sku}
              </p>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}