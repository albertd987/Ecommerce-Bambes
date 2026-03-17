import React, { createContext, useContext, useEffect, useMemo, useState } from "react"
import api from '../services/api'

const CartContext = createContext(null)

export function CartProvider({ children }) {
  const [cart, setCart] = useState(null) // Dades del servidor
  const [loading, setLoading] = useState(false)

  // Obtenir carret del servidor
  const fetchCart = async () => {
    console.log('Fetching cart...');
    try {
      // Obtenir token si existeix
      const cartToken = localStorage.getItem('cart_token')
      
      const response = await api.get("/cart", {
        params: cartToken ? { cart_token: cartToken } : {}
      })

      const cartData = response.data?.data ?? response.data

      console.log("Cart fetched RAW:", response.data)
      console.log("Cart parsed:", cartData)
      console.log("sub_total:", cartData?.sub_total)
      console.log("tax_total:", cartData?.tax_total)
      console.log("total:", cartData?.total)
      console.log("lines:", cartData?.lines?.length)

      setCart(cartData)

    } catch (error) {
      console.error('Error en obtenir carret:', error)
      console.error('Response:', error.response?.data);
      setCart(null)
    }
  }

  // Carregar carret a l'inici
  useEffect(() => {
    fetchCart()
  }, [])

  // Mantenir compatibilitat: items com a array de línies
  const items = useMemo(() => {
    console.log('Recalculating items from cart:', cart);

    if (!cart?.lines) {
      console.log('No cart or no lines');
      return []
    }

    const mappedItems = cart.lines.map(line => {
      console.log('Mapping line:', line);
      return {
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
      }
    });

    console.log('Mapped items:', mappedItems);
    return mappedItems;
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
    console.log('Adding item:', productRaw, qty);
    setLoading(true)
    try {
      const variantId = productRaw.variant_id || productRaw.id

      // Obtenir token del carret si existeix
      const cartToken = localStorage.getItem('cart_token')

      console.log('Sending to cart/add:', { 
        variant_id: variantId, 
        quantity: qty,
        cart_token: cartToken
      });

      const response = await api.post('/cart/add', {
        variant_id: variantId,
        quantity: Math.max(1, Number(qty) || 1),
        cart_token: cartToken // Enviar token si existeix
      })

      console.log('Add response:', response.data);

      // Desar el token que retorna el backend
      if (response.data?.data?.cart_token) {
        localStorage.setItem('cart_token', response.data.data.cart_token)
        console.log('Cart token saved:', response.data.data.cart_token)
      }

      await fetchCart() // Refrescar desde servidor

      console.log('Item added successfully');
      return { success: true }
    } catch (error) {
      console.error('Error en afegir:', error)
      console.error('Response:', error.response?.data);
      return { success: false, error: error.response?.data }
    } finally {
      setLoading(false)
    }
  }

  // Eliminar item del carret
  const removeItem = async (key) => {
    console.log('Removing item:', key);
    setLoading(true)
    try {
      const item = items.find(i => i.key === key)
      if (!item) {
        console.error('Item not found:', key);
        return { success: false }
      }

      const cartToken = localStorage.getItem('cart_token')

      console.log('Deleting line:', item.lineId);

      await api.delete(`/cart/lines/${item.lineId}`, {
        params: cartToken ? { cart_token: cartToken } : {}
      })

      console.log('Line deleted, refreshing cart');
      await fetchCart()

      return { success: true }
    } catch (error) {
      console.error('Error en eliminar:', error)
      console.error('Response:', error.response?.data);
      return { success: false }
    } finally {
      setLoading(false)
    }
  }

  // Actualitzar quantitat
  const setQty = async (key, qty) => {
    console.log('Updating quantity:', key, qty);
    setLoading(true)
    try {
      const item = items.find(i => i.key === key)
      if (!item) {
        console.error('Item not found:', key);
        return { success: false }
      }

      const nextQty = Math.max(1, Number(qty) || 1)
      const cartToken = localStorage.getItem('cart_token')

      console.log('Updating line:', item.lineId, 'to qty:', nextQty);

      await api.put(`/cart/lines/${item.lineId}`, {
        quantity: nextQty,
        cart_token: cartToken
      })

      console.log('Quantity updated, refreshing cart');
      await fetchCart()

      return { success: true }
    } catch (error) {
      console.error('Error en actualitzar:', error)
      console.error('Response:', error.response?.data);
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