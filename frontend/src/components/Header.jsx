import { ShoppingCart, Heart, Search, X, Menu } from "lucide-react"
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    setSearchValue(params.get("q") || "")
  }, [location.search])

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false)
  }, [location.pathname])

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
      <div className="container mx-auto flex h-16 items-center justify-between px-4 gap-2 md:gap-4">

        {/* Left: hamburger (mobile) + logo */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Hamburger – only on mobile */}
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-md hover:bg-muted transition-colors md:hidden"
            aria-label={mobileMenuOpen ? t("nav.closeMenu", "Tancar menú") : t("nav.openMenu", "Obrir menú")}
            onClick={() => setMobileMenuOpen((prev) => !prev)}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>

          <h1 className="text-xl font-bold">{t("app.name")}</h1>
        </div>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-6">
          <Link to="/" className={navLinkClass}>
            {t("nav.products")}
          </Link>

          <Link to="/about" className={navLinkClass}>
            {t("nav.about")}
          </Link>
        </nav>

        {/* Right: icons */}
        <div className="flex items-center gap-1 md:gap-3">
          {/* Search */}
          <div className="relative flex items-center">
            {searchOpen ? (
              <form onSubmit={handleSearchSubmit} className="flex items-center gap-1 md:gap-2">
                <div className="flex items-center rounded-md border bg-background px-3 h-10 w-[calc(100vw-8rem)] sm:w-[260px] md:w-[220px]">
                  <Search className="h-4 w-4 text-muted-foreground mr-2 shrink-0" />
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

          {/* Language switcher – hide on mobile when search is open to save space */}
          <div className={`inline-flex items-center rounded-md border bg-background p-1 ${searchOpen ? "hidden sm:inline-flex" : "inline-flex"}`}>
            <button
              type="button"
              onClick={() => switchTo("ca")}
              className={`px-1.5 py-1 text-xs font-medium rounded md:px-2 ${
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
              className={`px-1.5 py-1 text-xs font-medium rounded md:px-2 ${
                lang.startsWith("en")
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              aria-label={t("lang.switchToEnAria", "Switch to English")}
            >
              {t("lang.en", "EN")}
            </button>
          </div>

          {/* Favorites – hide on mobile when search is open */}
          <Link
            to="/favorites"
            className={`relative inline-flex h-10 w-10 items-center justify-center rounded-md hover:bg-muted transition-colors ${searchOpen ? "hidden sm:inline-flex" : "inline-flex"}`}
            aria-label={t("favorites.title", "Els meus favorits")}
          >
            <Heart className="h-5 w-5" />
            {favoritesCount > 0 && (
              <span className="absolute -top-1 -right-1 h-5 min-w-5 px-1 rounded-full bg-primary text-xs text-primary-foreground flex items-center justify-center">
                {favoritesCount}
              </span>
            )}
          </Link>

          {/* User */}
          <UserMenu />

          {/* Cart */}
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

      {/* Mobile nav drawer */}
      {mobileMenuOpen && (
        <nav className="md:hidden border-t bg-background px-4 py-3 flex flex-col gap-1">
          <Link
            to="/"
            className="block rounded-md px-3 py-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            onClick={() => setMobileMenuOpen(false)}
          >
            {t("nav.products")}
          </Link>
          <Link
            to="/about"
            className="block rounded-md px-3 py-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            onClick={() => setMobileMenuOpen(false)}
          >
            {t("nav.about")}
          </Link>
        </nav>
      )}
    </header>
  )
}
