import { ShoppingCart, Heart, Search, X } from "lucide-react"
import { Link, useNavigate, useLocation } from "react-router-dom"
import { useCart } from "@/context/cart-context"
import { useFavorites } from "@/context/favorites-context"
import UserMenu from "@/components/UserMenu"
import { useTranslation } from "react-i18next"
import { setLanguage } from "@/i18n"
import { useEffect, useState } from "react"

export default function Header() {
  const { cartCount } = useCart()
  const { favorites } = useFavorites()
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()

  const lang = i18n.language || "ca"
  const favoritesCount = favorites?.length ?? 0

  const [searchOpen, setSearchOpen] = useState(false)
  const [searchValue, setSearchValue] = useState("")

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    setSearchValue(params.get("q") || "")
  }, [location.search])

  const switchTo = (next) => {
    if (next === lang) return
    setLanguage(next)
  }

  const navLinkClass =
    "text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"

  const handleSearchSubmit = (e) => {
    e.preventDefault()
    const q = searchValue.trim()

    if (!q) {
      navigate("/")
      setSearchOpen(false)
      return
    }

    navigate(`/?q=${encodeURIComponent(q)}`)
    setSearchOpen(false)
  }

  const clearSearch = () => {
    setSearchValue("")
    navigate("/")
    setSearchOpen(false)
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 gap-4">
        <div className="flex items-center gap-2 shrink-0">
          <h1 className="text-xl font-bold">{t("app.name")}</h1>
        </div>

        <nav className="hidden md:flex items-center gap-6">
          <Link to="/" className={navLinkClass}>
            {t("nav.products")}
          </Link>



          <Link to="/about" className={navLinkClass}>
            {t("nav.about")}
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          {/* Cerca */}
          <div className="relative flex items-center">
            {searchOpen ? (
              <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
                <div className="flex items-center rounded-md border bg-background px-3 h-10 w-[220px]">
                  <Search className="h-4 w-4 text-muted-foreground mr-2" />
                  <input
                    autoFocus
                    type="text"
                    value={searchValue}
                    onChange={(e) => setSearchValue(e.target.value)}
                    placeholder={t("home.filters.searchPlaceholder", "Ex: HOKA, Clifton...")}
                    className="w-full bg-transparent text-sm outline-none"
                  />
                </div>

                {searchValue.trim() ? (
                  <button
                    type="button"
                    onClick={clearSearch}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-md hover:bg-muted transition-colors"
                    aria-label={t("home.actions.clear", "Netejar")}
                  >
                    <X className="h-4 w-4" />
                  </button>
                ) : null}
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                className="relative inline-flex h-10 w-10 items-center justify-center rounded-md hover:bg-muted transition-colors"
                aria-label={t("home.filters.search", "Cerca")}
              >
                <Search className="h-5 w-5" />
              </button>
            )}
          </div>

          {/* Selector idioma */}
          <div className="inline-flex items-center rounded-md border bg-background p-1">
            <button
              type="button"
              onClick={() => switchTo("ca")}
              className={`px-2 py-1 text-xs font-medium rounded ${
                lang.startsWith("ca")
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              aria-label={t("lang.switchToCaAria", "Canviar a Català")}
            >
              {t("lang.ca", "CA")}
            </button>

            <button
              type="button"
              onClick={() => switchTo("en")}
              className={`px-2 py-1 text-xs font-medium rounded ${
                lang.startsWith("en")
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              aria-label={t("lang.switchToEnAria", "Switch to English")}
            >
              {t("lang.en", "EN")}
            </button>
          </div>

          {/* FAVORITS */}
          <Link
            to="/favorites"
            className="relative inline-flex h-10 w-10 items-center justify-center rounded-md hover:bg-muted transition-colors"
            aria-label={t("favorites.title", "Els meus favorits")}
          >
            <Heart className="h-5 w-5" />
            {favoritesCount > 0 && (
              <span className="absolute -top-1 -right-1 h-5 min-w-5 px-1 rounded-full bg-primary text-xs text-primary-foreground flex items-center justify-center">
                {favoritesCount}
              </span>
            )}
          </Link>

          {/* USUARI */}
          <UserMenu />

          {/* CISTELLA */}
          <Link
            to="/cart"
            className="relative inline-flex h-10 w-10 items-center justify-center rounded-md hover:bg-muted transition-colors"
            aria-label={t("cart.title", "Carret")}
          >
            <ShoppingCart className="h-5 w-5" />
            <span className="absolute -top-1 -right-1 h-5 min-w-5 px-1 rounded-full bg-primary text-xs text-primary-foreground flex items-center justify-center">
              {cartCount}
            </span>
          </Link>
        </div>
      </div>
    </header>
  )
}