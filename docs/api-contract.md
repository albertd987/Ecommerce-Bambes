# Contracte d'API

## Base URL
```
http://localhost:8000/api
```

## Endpoints

### Productes
- `GET /api/products` - Llistar productes
- `GET /api/products/{id}` - Detall del producte

### Carrito
- `GET /api/cart` - Veure carrito
- `POST /api/cart/add` - Afegir al carrito
- `DELETE /api/cart/{item_id}` - Eliminar

### Autenticació
- `POST /api/register` - Registre
- `POST /api/login` - Login
- `POST /api/logout` - Logout

### Checkout
- `POST /api/checkout/create-payment-intent` - Iniciar pagament
- `POST /api/checkout/confirm` - Confirmar comanda

### Comandes
- `GET /api/orders` - Historial
- `GET /api/orders/{id}` - Detall

---

**Última actualització:** 13 Gener 2026
