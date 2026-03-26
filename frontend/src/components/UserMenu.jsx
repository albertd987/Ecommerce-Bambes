import { useEffect, useRef, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { User } from "lucide-react"
import { useAuth } from "@/context/auth-context"
import { useTranslation } from "react-i18next"

export default function UserMenu() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { isLoggedIn, user, logout } = useAuth()

  const [open, setOpen] = useState(false)

  // Millora PRO: delay de tancament + cancel·lació
  const closeTimer = useRef(null)

  const handleOpen = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current)
      closeTimer.current = null
    }
    setOpen(true)
  }

  const handleClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current)

    closeTimer.current = setTimeout(() => {
      setOpen(false)
      closeTimer.current = null
    }, 120) // <- ajusta si vols més "tolerància"
  }

  // Toggle on tap (touch devices don't fire mouseenter reliably)
  const handleToggle = () => {
    if (open) {
      setOpen(false)
    } else {
      handleOpen()
    }
  }

  // Close on outside click
  const containerRef = useRef(null)
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleOutsideClick)
      document.addEventListener("touchstart", handleOutsideClick)
    }
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick)
      document.removeEventListener("touchstart", handleOutsideClick)
    }
  }, [open])

  // Neteja del timer al desmontar
  useEffect(() => {
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current)
    }
  }, [])

  return (
    <div className="relative" ref={containerRef}>
      {/* Trigger */}
      <button
        type="button"
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-md hover:bg-muted transition-colors"
        aria-label={t("userMenu.aria.user", "Usuari")}
        onClick={handleToggle}
        onMouseEnter={handleOpen}
        onMouseLeave={handleClose}
        onFocus={handleOpen}
        onBlur={handleClose}
      >
        <User className="h-5 w-5" />
      </button>

      {/* Dropdown – anchored right; clamped so it never overflows on small screens */}
      {open && (
        <div
          className="absolute right-0 mt-2 w-56 max-w-[calc(100vw-2rem)] rounded-md border bg-background shadow-md z-50"
          onMouseEnter={handleOpen}
          onMouseLeave={handleClose}
        >
          {isLoggedIn ? (
            <div className="p-2">
              <div className="px-2 py-2">
                <p className="text-xs text-muted-foreground">
                  {t("userMenu.signedInAs", "Sessió iniciada com")}
                </p>
                <p className="text-sm font-medium truncate">
                  {user?.name || user?.email}
                </p>
              </div>

              <div className="h-px bg-border my-2" />

              <Link
                to="/profile"
                className="flex items-center min-h-[44px] px-2 py-2 text-sm rounded-md hover:bg-muted"
                onClick={() => setOpen(false)}
              >
                {t("userMenu.myProfile", "El meu perfil")}
              </Link>

              <Link
                to="/orders"
                className="flex items-center min-h-[44px] px-2 py-2 text-sm rounded-md hover:bg-muted"
                onClick={() => setOpen(false)}
              >
                {t("userMenu.myOrders", "Les meves comandes")}
              </Link>

              <div className="h-px bg-border my-2" />

              <button
                type="button"
                className="flex items-center w-full min-h-[44px] text-left px-2 py-2 text-sm rounded-md hover:bg-muted text-destructive"
                onClick={() => {
                  setOpen(false)
                  logout()
                  navigate("/")
                }}
              >
                {t("userMenu.logout", "Tancar sessió")}
              </button>
            </div>
          ) : (
            <div className="p-2">
              <div className="px-2 py-2">
                <p className="text-sm font-medium">
                  {t("userMenu.notLoggedIn.title", "No has iniciat sessió")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("userMenu.notLoggedIn.subtitle", "Entra per comprar i veure comandes")}
                </p>
              </div>

              <div className="h-px bg-border my-2" />

              <Link
                to="/login"
                className="flex items-center min-h-[44px] px-2 py-2 text-sm rounded-md hover:bg-muted"
                onClick={() => setOpen(false)}
              >
                {t("userMenu.login", "Iniciar sessió")}
              </Link>

              <Link
                to="/register"
                className="flex items-center min-h-[44px] px-2 py-2 text-sm rounded-md hover:bg-muted"
                onClick={() => setOpen(false)}
              >
                {t("userMenu.register", "Crear compte")}
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
