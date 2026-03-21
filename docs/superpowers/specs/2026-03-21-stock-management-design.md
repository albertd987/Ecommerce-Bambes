# Disseny: Gestió d'Stock Real

**Data:** 2026-03-21
**Estat:** Aprovat

## Context

El projecte Bambes (e-commerce Laravel+Lunar amb frontend React) té una gestió d'stock bàsica: un camp `stock` a `lunar_product_variants` que es decrementa directament. No hi ha traçabilitat de moviments, alertes de stock baix, ni interfície d'admin per gestionar stock. A més, el frontend mostra el número exacte d'stock, cosa que no és pràctica habitual.

Bug conegut: l'stock no es decrementa correctament al confirmar una compra.

## Decisió de disseny

**Opció escollida:** Taula de moviments d'stock independent (Opció A)

Descartades:
- Opció B (camp stock directe sense historial): no ofereix traçabilitat
- Opció C (Spatie Activitylog): dissenyat per logging genèric, no per gestió d'stock; acabaria requerint codi custom a sobre del package

## Fora de scope

- Reserves temporals d'stock al carret
- Gestió multi-magatzem
- Backorder / "Disponible en X dies"

---

## 1. Model de dades

### Nova taula `stock_movements`

| Camp | Tipus | Descripció |
|------|-------|------------|
| `id` | bigint, PK | Autoincrement |
| `product_variant_id` | FK → lunar_product_variants | Variant afectada |
| `quantity` | integer | Positiu = entrada, negatiu = sortida |
| `type` | enum string | `sale`, `cancellation`, `return`, `adjustment`, `reception`, `initial` |
| `reference` | string, nullable | Ex: "Comanda #1234", "Ajust manual" |
| `notes` | text, nullable | Comentari lliure de l'admin |
| `user_id` | FK → users, nullable | Qui ha fet el moviment (null si és sistema) |
| `created_at` | timestamp | |

**Immutabilitat:** els moviments són registres append-only. Mai es modifiquen ni s'esborren. La migració usa `$table->timestamp('created_at')` (sense `updated_at`).

**Índexs:** índex compost `(product_variant_id, created_at)` per optimitzar les consultes d'historial.

**Format de `reference`:** per vendes i devolucions, usar format estructurat `order:{order_id}` per facilitar consultes i links a l'admin.

### Camp `stock` a `product_variants`

Es manté com a camp denormalitzat per rendiment. Es sincronitza automàticament amb cada moviment. **Mai es modifica directament** — sempre a través d'un moviment. El camp `stock` segueix sent llegible server-side (ex: validació al `CartController`) tot i que no s'exposa via API.

---

## 2. Servei StockService

Punt únic d'entrada per TOTS els canvis d'stock. Cap controller, seeder ni servei toca `variant->stock` directament.

### Mètode principal

```
StockService::move(variant, quantity, type, reference?, notes?, user?)
```

- Crea un `StockMovement`
- Actualitza `variant->stock` atòmicament dins transacció DB amb `lockForUpdate()` (pessimistic locking) per evitar race conditions entre peticions concurrents
- Dispara event `StockUpdated`
- Llança excepció si el resultat seria stock negatiu
- Canviar el default de `purchasable` de `'always'` a `'in_stock'` als nous productes per activar la protecció d'stock negatiu

### Mètodes de conveniència

| Mètode | Quantity | Type | Ús |
|--------|----------|------|-----|
| `sell(variant, qty, orderId)` | -qty | `sale` | Checkout confirmat |
| `cancel(variant, qty, orderId)` | +qty | `cancellation` | Pagament fallat / cancel·lació |
| `return(variant, qty, orderId)` | +qty | `return` | Devolució client |
| `adjust(variant, qty, notes, user)` | ±qty | `adjustment` | Admin manual |
| `receive(variant, qty, notes, user)` | +qty | `reception` | Recepció mercaderia |
| `setInitial(variant, qty, user?)` | +qty | `initial` | Creació producte (una sola vegada per variant, llança excepció si ja té moviments) |

---

## 3. Refactorització del codi existent

| Fitxer | Ara | Després |
|--------|-----|---------|
| `CheckoutController::confirm()` | `$variant->decrement('stock', $qty)` | `StockService::sell($variant, $qty, $order->id)` |
| `SimpleProductCreator::create()` | `'stock' => $data['stock']` directament | `StockService::setInitial($variant, $data['stock'])` |
| `CartController::add()` | Comprova `$variant->stock < $qty` | Sense canvis (lectura d'stock no canvia) |
| `ProductController::show()` | Retorna `'stock' => $variant->stock` | Retorna `'stock_status' => StockService::getStatus($variant)` |
| `SimpleProductCreator::create()` | `'purchasable' => 'always'` | `'purchasable' => 'in_stock'` |

Inclou investigar i arreglar el bug on l'stock no es decrementa al checkout.

---

## 4. Alertes de stock baix

### Mecanisme

- Event `StockUpdated` es dispara a cada `StockService::move()`
- Listener `CheckLowStock` comprova si l'stock ha caigut per sota del llindar
- Envia notificació si creua el llindar cap avall
- Es reseteja si l'stock torna a pujar per sobre del llindar (no re-notifica fins que torna a baixar)

### Configuració

- Llindar: `config('stock.low_threshold')` = 10
- Centralitzat: mateix valor pel frontend i les alertes

### Notificació

- Email a l'admin (configurable)
- Notificació dins Filament (campaneta del panel admin)
- Contingut: nom del producte + variant (talla/color), stock actual, link a l'admin

---

## 5. Frontend — Indicadors qualitatius

### Lògica de visualització (calculada server-side)

La lògica de llindars s'avalua **només al backend** via `StockService::getStatus($variant)` usant `config('stock.low_threshold')`. El frontend simplement mostra l'status que rep de l'API sense conèixer els llindars.

| `stock_status` | Indicador | Estil |
|----------------|-----------|-------|
| `in_stock` | "En stock" | Verd |
| `low_stock` | "Últimes unitats" | Taronja |
| `out_of_stock` | "Esgotat" | Vermell, botó desactivat |

### Canvis

- **ProductDetailPage:** substituir `{currentVariant.stock} unitats` per indicador qualitatiu
- **ProductCard (llistat):** badge "Esgotat" en vermell quan stock = 0
- **Botons de talla:** els de stock 0 es mostren desactivats (ja funciona)

### API

L'API retorna `stock_status` en lloc del número exacte:

```json
{
  "stock_status": "in_stock" | "low_stock" | "out_of_stock"
}
```

### Traduccions (ca/en)

- "En stock" / "In stock"
- "Últimes unitats" / "Last units"
- "Esgotat" / "Out of stock"

---

## 6. Gestió d'stock des de l'admin (Filament)

### Pestanya "Stock" al detall de producte

**A) Ajust ràpid per variant:**
- Taula amb totes les variants (talla/color) i stock actual
- Botó "Ajustar" per variant → modal amb:
  - Camp quantitat (positiu per entrada, negatiu per sortida)
  - Selector de tipus: `adjustment` o `reception`
  - Camp notes (opcional)
  - Previsualització: "Stock actual: 15 → Nou stock: 25"

**B) Historial de moviments:**
- Taula amb tots els moviments de totes les variants del producte
- Columnes: Data, Variant (talla/color), Quantitat (+/-), Tipus, Referència, Usuari
- Filtrable per variant, tipus i rang de dates
- Ordenat per data descendent

S'integra dins el resource de producte existent com a tab addicional.
