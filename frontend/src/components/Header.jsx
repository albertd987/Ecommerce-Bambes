import { ShoppingCart } from "lucide-react"
import { Link } from "react-router-dom"
import { useCart } from "@/context/cart-context"
import UserMenu from "@/components/UserMenu"
import { useTranslation } from "react-i18next"
import { setLanguage } from "@/i18n"

export default function Header() {
  const { cartCount } = useCart()
  const { t, i18n } = useTranslation()

  const lang = i18n.language || "ca"

  const switchTo = (next) => {
    if (next === lang) return
    setLanguage(next)
  }

  const navLinkClass =
    "text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold">{t("app.name")}</h1>
        </div>

        <nav className="hidden md:flex items-center gap-6">
          <Link to="/" className={navLinkClass}>
            {t("nav.products")}
          </Link>

          <a href="#" className={navLinkClass}>
            {t("nav.brands")}
          </a>

          <a href="#" className={navLinkClass}>
            {t("nav.offers")}
          </a>

          {/* ✅ QUI SOM dins del nav per mantenir-ho uniforme */}
          <Link to="/about" className={navLinkClass}>
            {t("nav.about")}
          </Link>
        </nav>

        <div className="flex items-center gap-3">
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