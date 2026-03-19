import React, { createContext, useContext, useEffect, useMemo, useState } from "react"
import api from '../services/api'
import { useAuth } from './auth-context'

const CartContext = createContext(null)

export function CartProvider({ children }) {
  const [cart, setCart] = useState(null) // Dades del servidor
  const [loading, setLoading] = useState(false)

  const { isLoggedIn, loading: authLoading } = useAuth()

  // Obtenir carret del servidor
  const fetchCart = async () => {
    try {
      const cartToken = localStorage.getItem('cart_token')

      const response = await api.get("/cart", {
        params: cartToken ? { cart_token: cartToken } : {}
      })

      const cartData = response.data?.data ?? response.data
      setCart(cartData)

    } catch (error) {
      console.error('Error en obtenir carret:', error)
      setCart(null)
    }
  }

  // Carregar carret quan auth resol. Si no loguejat, netejar token i estat.
  useEffect(() => {
    if (authLoading) return
    if (isLoggedIn) {
      fetchCart()
    } else {
      localStorage.removeItem('cart_token')
      setCart(null)
    }
  }, [isLoggedIn, authLoading])

  // Mantenir compatibilitat: items com a array de línies
  const items = useMemo(() => {
    if (!cart?.lines) return []

    return cart.lines.map(line => ({
      key: `line:${line.id}`,
      lineId: line.id,
      product: {
        id: line.product.id,
        name: line.product.name,
        price: line.unit_price,
        image: line.product.thumbnail || 'https://via.placeholder.com/200x200/e5e7eb/6b7280?text=No+Image',
        brand: line.variant?.sku?.split('-')[0] || 'Unknown',
      },
      qty: line.quantity,
    }))
  }, [cart])

  // Comptador d'items
  const cartCount = useMemo(
    () => items.reduce((acc, line) => acc + line.qty, 0),
    [items]
  )

  // Subtotal
  const cartSubtotal = useMemo(() => cart?.sub_total || 0, [cart])

  // Total (amb impostos)
  const cartTotal = useMemo(() => cart?.total || 0, [cart])

  // Impostos
  const cartTax = useMemo(() => cart?.tax_total || 0, [cart])

  // Afegir producte al carret
  const addItem = async (productRaw, qty = 1) => {
    setLoading(true)
    try {
      const variantId = productRaw.variant_id || productRaw.id
      const cartToken = localStorage.getItem('cart_token')

      const response = await api.post('/cart/add', {
        variant_id: variantId,
        quantity: Math.max(1, Number(qty) || 1),
        cart_token: cartToken,
      })

      // Desar el token que retorna el backend
      if (response.data?.data?.cart_token) {
        localStorage.setItem('cart_token', response.data.data.cart_token)
      }

      await fetchCart()
      return { success: true }
    } catch (error) {
      console.error('Error en afegir:', error)
      return { success: false, error: error.response?.data }
    } finally {
      setLoading(false)
    }
  }

  // Eliminar item del carret
  const removeItem = async (key) => {
    setLoading(true)
    try {
      const item = items.find(i => i.key === key)
      if (!item) return { success: false }

      const cartToken = localStorage.getItem('cart_token')

      await api.delete(`/cart/lines/${item.lineId}`, {
        params: cartToken ? { cart_token: cartToken } : {}
      })

      await fetchCart()
      return { success: true }
    } catch (error) {
      console.error('Error en eliminar:', error)
      return { success: false }
    } finally {
      setLoading(false)
    }
  }

  // Actualitzar quantitat
  const setQty = async (key, qty) => {
    setLoading(true)
    try {
      const item = items.find(i => i.key === key)
      if (!item) return { success: false }

      const nextQty = Math.max(1, Number(qty) || 1)
      const cartToken = localStorage.getItem('cart_token')

      await api.put(`/cart/lines/${item.lineId}`, {
        quantity: nextQty,
        cart_token: cartToken,
      })

      await fetchCart()
      return { success: true }
    } catch (error) {
      console.error('Error en actualitzar:', error)
      return { success: false }
    } finally {
      setLoading(false)
    }
  }

  // Alias
  const updateQty = setQty

  // Buidar carret
  const clearCart = async () => {
    setLoading(true)
    try {
      const cartToken = localStorage.getItem('cart_token')
      
      await api.delete('/cart', {
        params: cartToken ? { cart_token: cartToken } : {}
      })
      
      setCart(null)
      localStorage.removeItem('cart_token') // Eliminar token en buidar
      
      return { success: true }
    } catch (error) {
      console.error('Error en buidar:', error)
      return { success: false }
    } finally {
      setLoading(false)
    }
  }

  // Items plans (compatibilitat)
  const itemsFlat = useMemo(
    () => items.map(l => ({
      key: l.key,
      ...l.product,
      qty: l.qty,
    })),
    [items]
  )

  const value = useMemo(
    () => ({
      items,
      itemsFlat,
      cartCount,
      cartSubtotal,
      cartTotal,
      cartTax,
      loading,
      addItem,
      removeItem,
      setQty,
      updateQty,
      clearCart,
      refreshCart: fetchCart,
    }),
    [items, itemsFlat, cartCount, cartSubtotal, cartTotal, cartTax, loading]
  )

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error("useCart() s'ha d'usar dins de <CartProvider>.")
  return ctx
}