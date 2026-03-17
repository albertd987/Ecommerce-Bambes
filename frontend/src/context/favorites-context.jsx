import { createContext, useContext, useEffect, useMemo, useState } from "react"
import { getFavorites, toggleFavorite as apiToggleFavorite } from "@/services/api"
import { useAuth } from "@/context/auth-context"

const FavoritesContext = createContext({
  favorites: [],
  loading: false,
  isFavorite: () => false,
  toggleFavorite: async () => false,
  reloadFavorites: async () => {},
})

export function FavoritesProvider({ children }) {
  const { isLoggedIn } = useAuth()

  const [favorites, setFavorites] = useState([])
  const [loading, setLoading] = useState(false)

  const loadFavorites = async () => {
    if (!isLoggedIn) {
      setFavorites([])
      return
    }

    try {
      setLoading(true)
      const res = await getFavorites()

      const data = Array.isArray(res.data)
        ? res.data
        : Array.isArray(res.data?.data)
        ? res.data.data
        : []

      setFavorites(data)
    } catch (error) {
      console.error("Error carregant favorits:", error)
      setFavorites([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadFavorites()
  }, [isLoggedIn])

  const isFavorite = (productId) => {
    return favorites.some((f) => f?.id === productId)
  }

  const toggleFavorite = async (productId) => {
    try {
      const res = await apiToggleFavorite(productId)
      const favorited = !!res.data?.favorited

      if (favorited) {
        await loadFavorites()
        return true
      }

      setFavorites((prev) => prev.filter((f) => f?.id !== productId))
      return false
    } catch (error) {
      console.error("Error fent toggle favorite:", error)
      throw error
    }
  }

  const value = useMemo(
    () => ({
      favorites,
      loading,
      isFavorite,
      toggleFavorite,
      reloadFavorites: loadFavorites,
    }),
    [favorites, loading]
  )

  return (
    <FavoritesContext.Provider value={value}>
      {children}
    </FavoritesContext.Provider>
  )
}

export function useFavorites() {
  return useContext(FavoritesContext)
}