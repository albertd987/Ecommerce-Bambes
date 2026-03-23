import { createContext, useContext, useState, useEffect, useMemo } from 'react'
import { login as apiLogin, logout as apiLogout, register as apiRegister, getCurrentUser } from '../services/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    try {
      const response = await getCurrentUser()
      if (response.data) {
        setUser(response.data)
      }
    } catch (error) {
      console.error('Error verificant autenticació:', error)
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  const login = async (email, password) => {
    try {
      const response = await apiLogin({ email, password })
      setUser(response.data)
      return { success: true }
    } catch (error) {
      console.error('Error al fer login:', error)
      return {
        success: false,
        error: error.response?.data?.error || 'Error al iniciar sessió',
      }
    }
  }

  const register = async (name, email, password, passwordConfirmation) => {
    try {
      const response = await apiRegister({
        name,
        email,
        password,
        password_confirmation: passwordConfirmation,
      })
      setUser(response.data)
      return { success: true }
    } catch (error) {
      console.error('Error al registrar:', error)
      return {
        success: false,
        error: error.response?.data?.error || 'Error al registrar-se',
        errors: error.response?.data?.errors || {},
      }
    }
  }

  const logout = async () => {
    try {
      await apiLogout()
      setUser(null)
    } catch (error) {
      console.error('Error al fer logout:', error)
      setUser(null)
    }
  }

  const updateUser = (nextUserData) => {
    setUser(nextUserData)
  }

  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      register,
      logout,
      updateUser,
      isLoggedIn: !!user,
    }),
    [user, loading]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth() s'ha d'usar dins de <AuthProvider>.")
  return ctx
}