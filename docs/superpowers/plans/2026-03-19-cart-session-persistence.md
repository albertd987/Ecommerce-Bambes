# Cart Session Persistence — Pla d'Implementació

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** El carret s'ha de mantenir entre sessions de login/logout, com a qualsevol botiga online (Amazon, Zalando).

**Architecture:** El problema real és que Lunar guarda el `cart_id` a la sessió de Laravel (`lunar_cart` key) dins del listener `CartSessionAuthListener::login()`, però immediatament després `AuthController::login()` crida `$request->session()->regenerate()` que destrueix les dades en memòria. La solució és NO dependre del listener de Lunar per restaurar el carret, sinó afegir un fallback directe per `user_id` al `CartController::getCartByTokenOrSession()`, i restaurar la sessió de Lunar en trobar-lo.

**Tech Stack:** Laravel 11, Lunar PHP 1.2, PHPUnit 10.5, Vitest + React Testing Library

---

## Context tècnic (llegir abans d'implementar)

### El flux que NO funciona (actual)

```
Auth::attempt()
  └→ Dispara event Login
     └→ CartSessionAuthListener::login()
        └→ Cart::whereUserId($id)->active()->first() → TROBA el carret ✓
        └→ CartSession::use($cart) → sessionManager->put('lunar_cart', $cartId) [en memòria]

$request->session()->regenerate()  ← AQUÍ ES PERDEN LES DADES
  └→ Nova sessió → dades en memòria del listener → PERDUDES

Següent request:
  └→ CartSession::current() → fetchOrCreate()
     └→ sessionManager->get('lunar_cart') → NULL (sessió buida)
     └→ $user = authManager->user() → però user_id lookup SÍ que funciona!
     └→ HAURIA de trobar el carret... però no sempre ho fa
```

### Per què el fallback de `fetchOrCreate()` no funciona fiablement

El mètode `fetchOrCreate()` de `CartSessionManager` (línia 138-140 de `vendor/lunarphp/core/src/Managers/CartSessionManager.php`) fa:

```php
if (! $cartId && $user = $this->authManager->user()) {
    $cartId = $user->carts()->active()->first()?->id;
}
```

Això HAURIA de funcionar, però `$this->authManager->user()` depèn de que Sanctum resolvi l'usuari via cookie de sessió. Si la sessió ha estat regenerada o el request no porta el guard correcte, pot retornar `null`.

### La solució: fallback directe a `getCartByTokenOrSession()`

En lloc de dependre de `CartSession::current()` (que depèn del listener + sessió), el nostre `CartController` ha de tenir un fallback explícit que busqui el carret per `user_id` directament a la BD.

```
getCartByTokenOrSession(request):
  1. Si hi ha cart_token → busca per token → retorna
  2. Si no → CartSession::current() → retorna si trobat
  3. Si no → auth()->check() → busca per user_id a BD → retorna si trobat
  4. Si no → null
```

### Fitxers rellevants (llegir si necessites context)

| Fitxer | Què fa | Línies clau |
|--------|--------|-------------|
| `backend/app/Http/Controllers/Api/CartController.php` | Controlador del carret | L30-43: `getCartByTokenOrSession()` |
| `backend/app/Http/Controllers/Api/AuthController.php` | Login/logout | L98: `Auth::attempt()`, L105: `regenerate()`, L132: `CartSession::forget()` |
| `vendor/lunarphp/core/src/Managers/CartSessionManager.php` | Gestió de la sessió del carret | L118-127: `use()`, L132-168: `fetchOrCreate()`, L71-90: `forget()` |
| `vendor/lunarphp/core/src/Listeners/CartSessionAuthListener.php` | Listener que Lunar crida en login/logout | L27-51: `login()`, L58-65: `logout()` |
| `vendor/lunarphp/core/src/Models/Cart.php` | Model del carret | L257-262: `scopeActive()` |
| `backend/config/lunar/cart_session.php` | Config de sessió del carret | L47: `delete_on_forget` |
| `frontend/src/context/cart-context.jsx` | React context del carret | L42-51: effect que gestiona auth→cart |
| `frontend/src/__tests__/context/cart-context.test.jsx` | Tests del context | Tot el fitxer |
| `backend/tests/Feature/Cart/CartTest.php` | Tests backend del carret | L198-256: tests de persistència |
| `frontend/src/context/auth-context.jsx` | Context d'autenticació React | funció `login()` i `register()` |
| `frontend/src/services/api.js` | Servei HTTP del frontend | L19-28: `login()` i `register()` |

### El flux guest→user que falta (cobert per Tasks 7-9)

El pla (Tasks 1-5) cobreix la restauració del carret quan l'usuari **ja tenia** `user_id` al carret (havia iniciat sessió i afegit productes). Però **NO cobreix** el cas del convidat que afegeix productes i llavors inicia sessió — el carret guest no té `user_id` i el listener de Lunar intenta associar-lo, però `session()->regenerate()` destrueix la sessió just després.

**Flux problemàtic (actual):**

```
Convidat afegeix productes → carret amb cart_token (UUID al meta), sense user_id
Frontend guarda cart_token al localStorage

Convidat fa login:
  Auth::attempt()
    └→ CartSessionAuthListener::login() crida CartSession::associate($cart, $user, 'merge')
       └→ AssociateUser::execute() → posa user_id al carret [en memòria de sessió]

  session()->regenerate() → DESTRUEIX les dades de sessió escrites pel listener ✗

Resultat: carret guest SENSE user_id → getCartByTokenOrSession() no el troba
  (Task 1 fallback user_id busca per user_id, però el carret encara NO té user_id)
```

**Flux desitjat (amb Tasks 7-9):**

```
Convidat afegeix productes → carret amb cart_token (UUID al meta), sense user_id
Frontend guarda cart_token al localStorage

Convidat fa login (frontend envia cart_token al payload):
  Auth::attempt() → AuthController fa session()->regenerate()

  DESPRÉS de regenerate(), AuthController:
    1. Llegeix cart_token del payload
    2. Cerca: Cart::where('meta->token', $token)->whereNull('user_id')->first()
    3. Troba el carret guest → AssociateUser::execute($guestCart, $user, 'merge')
       └→ Si usuari té carret existent: MergeCart::execute() fusiona les línies
       └→ Retorna el carret final (el de l'usuari, amb les línies del guest)
    4. CartSession::use($resultCart) → clau lunar_cart escrita A la nova sessió ✓

Frontend:
  Elimina cart_token del localStorage (ja no necessari, el carret és de l'usuari)
  La següent crida a GET /api/cart retorna el carret restaurat per sessió
```

---

## Task 1: Fix backend — fallback per `user_id` a `getCartByTokenOrSession()`

**Files:**
- Modify: `backend/app/Http/Controllers/Api/CartController.php:30-43`
- Test: `backend/tests/Feature/Cart/CartTest.php`

### Què canvia

El mètode `getCartByTokenOrSession()` passa de 2 estratègies (token, sessió) a 3 (token, sessió, user_id).

- [ ] **Step 1: Escriure el test que falla**

Obrir `backend/tests/Feature/Cart/CartTest.php`. Substituir el test existent `test_cart_restored_after_relogin` (línia 228-255) per aquesta versió que reprodueix el bug real:

```php
public function test_cart_restored_after_relogin(): void
{
    $user = \App\Models\User::factory()->create([
        'password' => bcrypt('password123'),
    ]);
    $variant = $this->createVariant();

    // Login via real session (triggers Auth::attempt → regenerate)
    $this->postJson('/api/login', [
        'email'    => $user->email,
        'password' => 'password123',
    ])->assertStatus(200);

    // Add to cart (cart gets user_id via CartController::add)
    $this->postJson('/api/cart/add', [
        'variant_id' => $variant->id,
        'quantity'   => 1,
    ])->assertStatus(200);

    // Verify cart has items
    $cartBefore = $this->getJson('/api/cart');
    $this->assertNotEmpty($cartBefore->json('data.lines'));

    // Logout (clears session, keeps cart in DB)
    $this->postJson('/api/logout')->assertStatus(200);

    // Re-login via actingAs (simulates new session with authenticated user)
    $this->actingAs($user);

    // GET /api/cart without token — should find cart via user_id fallback
    $cartAfter = $this->getJson('/api/cart');
    $cartAfter->assertStatus(200);
    $this->assertNotNull($cartAfter->json('data'),
        'Cart should be restored after re-login via user_id fallback');
    $this->assertNotEmpty($cartAfter->json('data.lines'),
        'Cart should still have the same lines after re-login');
}
```

- [ ] **Step 2: Executar el test per verificar que falla**

```bash
cd /var/www/projecte2/backend
php artisan test --filter=test_cart_restored_after_relogin
```

Esperat: **FAIL** amb `Cart should be restored after re-login via user_id fallback` (assertNotNull falla perquè `data` és null).

- [ ] **Step 3: Implementar el fallback**

Obrir `backend/app/Http/Controllers/Api/CartController.php`. Substituir el mètode `getCartByTokenOrSession()` (línies 30-43) per:

```php
/**
 * Resol el carret actiu per token UUID, sessió de Laravel, o user_id.
 *
 * Estratègia en 3 passos:
 * 1. cart_token (localStorage del frontend) → per carrets de convidats
 * 2. CartSession::current() → sessió de Lunar (si el listener l'ha restaurat)
 * 3. user_id (BD directe) → fallback robust per quan la sessió es regenera
 */
private function getCartByTokenOrSession(Request $request)
{
    // 1. Token explícit del frontend
    $cartToken = $request->input('cart_token') ?? $request->query('cart_token');

    if ($cartToken) {
        $cart = Cart::where('meta->token', $cartToken)->first();
        if ($cart) {
            CartSession::use($cart);
            return $cart;
        }
    }

    // 2. Sessió de Lunar (lunar_cart key a la sessió)
    $cart = CartSession::current();
    if ($cart) {
        return $cart;
    }

    // 3. Fallback: buscar per user_id directament a la BD
    //    - SoftDeletes ja filtra deleted_at automàticament
    //    - latest() per agafar el carret més recent si n'hi ha més d'un
    if (auth()->check()) {
        $cart = Cart::whereUserId(auth()->id())
            ->active()
            ->latest()
            ->first();

        if ($cart) {
            // Restaurar a la sessió de Lunar per les següents requests
            CartSession::use($cart);
            return $cart;
        }
    }

    return null;
}
```

**IMPORTANT:** No canviar res més del fitxer. Només el mètode `getCartByTokenOrSession()`.

- [ ] **Step 4: Executar el test per verificar que passa**

```bash
cd /var/www/projecte2/backend
php artisan test --filter=test_cart_restored_after_relogin
```

Esperat: **PASS**

- [ ] **Step 5: Executar tota la suite backend per verificar que no s'ha trencat res**

```bash
cd /var/www/projecte2/backend
php artisan test
```

Esperat: **60 passed** (o més si has afegit tests), 0 failed.

- [ ] **Step 6: Commit**

```bash
cd /var/www/projecte2
git add backend/app/Http/Controllers/Api/CartController.php backend/tests/Feature/Cart/CartTest.php
git commit -m "fix: restaurar carret en re-login via fallback user_id a getCartByTokenOrSession

El listener de Lunar (CartSessionAuthListener::login) guarda el
cart_id a la sessió, però AuthController::login() crida
session()->regenerate() que destrueix les dades. Afegit un tercer
pas a getCartByTokenOrSession() que busca per user_id directament
a la BD si els dos primers mètodes (token, sessió) fallen."
```

---

## Task 2: Netejar `AuthController::logout()` — eliminar `CartSession::forget()` redundant

**Files:**
- Modify: `backend/app/Http/Controllers/Api/AuthController.php:130-143`

### Per què

Amb `delete_on_forget: false`, la crida explícita a `CartSession::forget()` dins de `AuthController::logout()` és redundant. El listener `CartSessionAuthListener::logout()` (que ja funciona gràcies al trait `LunarUser`) ja fa la mateixa crida. Tenir-la duplicada no causa errors però és confusa.

**IMPORTANT:** `CartSession::forget()` amb `delete_on_forget: false` NO esborra el carret de la BD. Només neteja la clau `lunar_cart` de la sessió. Això és correcte — volem que el carret quedi a la BD per restaurar-lo en re-login.

- [ ] **Step 1: Verificar que tots els tests passen abans de tocar res**

```bash
cd /var/www/projecte2/backend
php artisan test
```

Esperat: tot verd.

- [ ] **Step 2: Eliminar la línia `CartSession::forget()`**

Obrir `backend/app/Http/Controllers/Api/AuthController.php`. El mètode `logout()` actual (línies 130-143):

```php
public function logout(Request $request)
{
    CartSession::forget();           // ← ELIMINAR AQUESTA LÍNIA

    Auth::guard('web')->logout();
    Auth::forgetGuards();

    $request->session()->invalidate();
    $request->session()->regenerateToken();

    return response()->json([
        'message' => 'Sessió tancada correctament',
    ]);
}
```

Ha de quedar:

```php
public function logout(Request $request)
{
    Auth::guard('web')->logout();
    Auth::forgetGuards();

    $request->session()->invalidate();
    $request->session()->regenerateToken();

    return response()->json([
        'message' => 'Sessió tancada correctament',
    ]);
}
```

Opcionalment, eliminar el `use Lunar\Facades\CartSession;` del bloc d'imports (línia 12) si ja no s'usa enlloc del fitxer.

**Nota:** El listener `CartSessionAuthListener::logout()` s'encarrega automàticament de netejar la clau `lunar_cart` de la sessió quan es dispara l'event `Logout`. Això passa perquè `Auth::guard('web')->logout()` envia l'event amb `$event->user` poblat ABANS d'invalidar la sessió.

- [ ] **Step 3: Executar tota la suite per verificar que tot passa**

```bash
cd /var/www/projecte2/backend
php artisan test
```

Esperat: tot verd. Si falla algun test de carret, NO continuar — investigar.

- [ ] **Step 4: Commit**

```bash
cd /var/www/projecte2
git add backend/app/Http/Controllers/Api/AuthController.php
git commit -m "refactor: eliminar CartSession::forget() redundant de logout

El listener CartSessionAuthListener::logout() ja fa la mateixa
crida gràcies al trait LunarUser. La duplicació era confusa."
```

---

## Task 3: Afegir test d'integració complert — cicle login → cart → logout → login → cart restaurat

**Files:**
- Modify: `backend/tests/Feature/Cart/CartTest.php`

### Per què

El test actual `test_cart_restored_after_relogin` usa `actingAs()` per al re-login, que no passa per la sessió real. Cal un test d'integració que verifiqui tot el cicle amb el fallback `user_id`.

- [ ] **Step 1: Afegir test del cicle complet amb múltiples items**

Afegir DESPRÉS de `test_cart_restored_after_relogin` al fitxer `backend/tests/Feature/Cart/CartTest.php`:

```php
public function test_full_cart_persistence_cycle(): void
{
    $user = \App\Models\User::factory()->create([
        'password' => bcrypt('password123'),
    ]);
    $variant1 = $this->createVariant(3000, 10);
    $variant2 = $this->createVariant(5000, 10);

    // Login
    $this->postJson('/api/login', [
        'email'    => $user->email,
        'password' => 'password123',
    ])->assertStatus(200);

    // Add 2 products
    $this->postJson('/api/cart/add', [
        'variant_id' => $variant1->id,
        'quantity'   => 2,
    ])->assertStatus(200);

    $this->postJson('/api/cart/add', [
        'variant_id' => $variant2->id,
        'quantity'   => 1,
    ])->assertStatus(200);

    // Verify 2 lines in cart
    $cartBefore = $this->getJson('/api/cart');
    $linesBefore = $cartBefore->json('data.lines');
    $this->assertCount(2, $linesBefore);

    // Logout
    $this->postJson('/api/logout')->assertStatus(200);

    // Cart stays in DB
    $this->assertEquals(1, \Lunar\Models\Cart::count());

    // Re-login
    $this->actingAs($user);

    // Cart should restore with same 2 lines
    $cartAfter = $this->getJson('/api/cart');
    $linesAfter = $cartAfter->json('data.lines');
    $this->assertCount(2, $linesAfter, 'Both lines should be restored');
}
```

- [ ] **Step 2: Executar el test**

```bash
cd /var/www/projecte2/backend
php artisan test --filter=test_full_cart_persistence_cycle
```

Esperat: **PASS** (si Task 1 s'ha implementat correctament).

- [ ] **Step 3: Afegir test cross-user — un usuari no veu el carret d'un altre**

Afegir després de l'anterior:

```php
public function test_cart_is_not_shared_between_users(): void
{
    $user1 = \App\Models\User::factory()->create([
        'password' => bcrypt('password123'),
    ]);
    $user2 = \App\Models\User::factory()->create([
        'password' => bcrypt('password123'),
    ]);
    $variant = $this->createVariant();

    // User1 adds to cart
    $this->postJson('/api/login', [
        'email'    => $user1->email,
        'password' => 'password123',
    ])->assertStatus(200);

    $this->postJson('/api/cart/add', [
        'variant_id' => $variant->id,
        'quantity'   => 1,
    ])->assertStatus(200);

    $this->postJson('/api/logout')->assertStatus(200);

    // User2 should NOT see User1's cart
    $this->actingAs($user2);
    $cart = $this->getJson('/api/cart');
    $cart->assertStatus(200);
    $this->assertNull($cart->json('data'),
        'User2 should not see User1\'s cart');
}
```

- [ ] **Step 4: Executar els dos tests nous**

```bash
cd /var/www/projecte2/backend
php artisan test --filter="test_full_cart_persistence_cycle|test_cart_is_not_shared_between_users"
```

Esperat: **2 passed**

- [ ] **Step 5: Executar tota la suite**

```bash
cd /var/www/projecte2/backend
php artisan test
```

Esperat: tot verd.

- [ ] **Step 6: Commit**

```bash
cd /var/www/projecte2
git add backend/tests/Feature/Cart/CartTest.php
git commit -m "test: afegir tests de persistència de carret (cicle complet + cross-user)"
```

---

## Task 4: Test frontend — verificar que `fetchCart()` es crida quan `isLoggedIn` canvia a `true`

**Files:**
- Modify: `frontend/src/__tests__/context/cart-context.test.jsx`

### Per què

El frontend ja té el codi correcte (`useEffect` que crida `fetchCart()` quan `isLoggedIn` és `true`), però no hi ha cap test que ho verifiqui explícitament. Si algú canvia l'effect sense voler, el carret no es restauraria.

- [ ] **Step 1: Afegir test que verifica que `api.get('/cart')` es crida quan l'usuari fa login**

Obrir `frontend/src/__tests__/context/cart-context.test.jsx`. Afegir ABANS dels `it.todo()` (línia 57):

```jsx
it('calls GET /api/cart when user becomes logged in', async () => {
    const api = (await import('@/services/api')).default
    api.get.mockResolvedValue({
      data: {
        data: {
          id: 1,
          lines: [{ id: 1, quantity: 2, product: { id: 1, name: 'Shoe' }, variant: { id: 1, sku: 'S-42' }, unit_price: 50, sub_total: 100 }],
          sub_total: 100,
          tax_total: 21,
          total: 100,
        },
      },
    })

    // Start not logged in
    mockIsLoggedIn = false
    mockLoading = false

    const { rerender } = renderHook(() => useCart(), { wrapper: CartProvider })

    // Simulate login
    act(() => { mockIsLoggedIn = true })
    rerender()

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/cart', expect.anything())
    })
  })
```

- [ ] **Step 2: Executar els tests frontend**

```bash
cd /var/www/projecte2/frontend
npm test
```

Esperat: **PASS** (el codi ja existeix, estem afegint cobertura).

- [ ] **Step 3: Commit**

```bash
cd /var/www/projecte2
git add frontend/src/__tests__/context/cart-context.test.jsx
git commit -m "test: verificar que fetchCart es crida en fer login (frontend)"
```

---

## Task 5: Netejar console.logs del cart-context

**Files:**
- Modify: `frontend/src/context/cart-context.jsx`

### Per què

El `fetchCart()` i altres funcions estan plens de `console.log()` de debugging que no haurien d'estar a producció. Ara que tenim tests, podem netejar-los amb confiança.

- [ ] **Step 1: Eliminar tots els `console.log()` i `console.error()` de `cart-context.jsx`**

Obrir `frontend/src/context/cart-context.jsx`. Eliminar TOTES les línies que comencen amb `console.log(` o `console.error(`. Hi ha aproximadament 20 línies a eliminar repartides per tot el fitxer.

**Funcions afectades:** `fetchCart`, `items useMemo`, `addItem`, `removeItem`, `setQty`, `clearCart`.

NO eliminar cap altra cosa. Només les línies `console.log(...)` i `console.error(...)`.

- [ ] **Step 2: Executar els tests frontend**

```bash
cd /var/www/projecte2/frontend
npm test
```

Esperat: tot verd.

- [ ] **Step 3: Commit**

```bash
cd /var/www/projecte2
git add frontend/src/context/cart-context.jsx
git commit -m "chore: eliminar console.logs de debugging del cart-context"
```

---

## Task 7: Backend — Associar carret de convidat en fer login

**Files:**
- Modify: `backend/app/Http/Controllers/Api/AuthController.php`
- Test: `backend/tests/Feature/Cart/CartTest.php`

### Què canvia

`AuthController::login()` accepta un `cart_token` opcional al payload. Després de `Auth::attempt()` + `session()->regenerate()`, si es rep `cart_token`, busca el carret guest i l'associa amb l'usuari usant `AssociateUser`.

- [ ] **Step 1: Escriure els tests que fallen**

Afegir al final de `backend/tests/Feature/Cart/CartTest.php` (ABANS del `}` de tancament de la classe):

```php
public function test_guest_cart_is_associated_on_login(): void
{
    $user = \App\Models\User::factory()->create([
        'password' => bcrypt('password123'),
    ]);
    $variant = $this->createVariant();

    // Create a guest cart with cart_token (simulates a guest adding items)
    $guestCart = \Lunar\Models\Cart::factory()->create([
        'meta' => ['token' => 'guest-token-abc123'],
    ]);
    $guestCart->lines()->create([
        'purchasable_type' => \Lunar\Models\ProductVariant::class,
        'purchasable_id'   => $variant->id,
        'quantity'         => 2,
        'meta'             => null,
    ]);

    $this->assertNull($guestCart->user_id, 'Guest cart should have no user_id before login');

    // Login with cart_token in payload
    $this->postJson('/api/login', [
        'email'      => $user->email,
        'password'   => 'password123',
        'cart_token' => 'guest-token-abc123',
    ])->assertStatus(200);

    // Guest cart should now be associated with the user
    $guestCart->refresh();
    $this->assertEquals($user->id, $guestCart->user_id,
        'Guest cart should be associated with user after login');

    // GET /api/cart should return the cart with the original lines
    $this->actingAs($user);
    $cart = $this->getJson('/api/cart');
    $cart->assertStatus(200);
    $this->assertNotEmpty($cart->json('data.lines'),
        'Cart should contain the guest lines after login');
}

public function test_guest_cart_merges_with_existing_user_cart_on_login(): void
{
    $user = \App\Models\User::factory()->create([
        'password' => bcrypt('password123'),
    ]);
    $variant1 = $this->createVariant(3000, 10);
    $variant2 = $this->createVariant(5000, 10);

    // Create existing user cart with one line
    $userCart = \Lunar\Models\Cart::factory()->create(['user_id' => $user->id]);
    $userCart->lines()->create([
        'purchasable_type' => \Lunar\Models\ProductVariant::class,
        'purchasable_id'   => $variant1->id,
        'quantity'         => 1,
        'meta'             => null,
    ]);

    // Create guest cart with a different line
    $guestCart = \Lunar\Models\Cart::factory()->create([
        'meta' => ['token' => 'guest-token-merge-test'],
    ]);
    $guestCart->lines()->create([
        'purchasable_type' => \Lunar\Models\ProductVariant::class,
        'purchasable_id'   => $variant2->id,
        'quantity'         => 3,
        'meta'             => null,
    ]);

    // Login with cart_token
    $this->postJson('/api/login', [
        'email'      => $user->email,
        'password'   => 'password123',
        'cart_token' => 'guest-token-merge-test',
    ])->assertStatus(200);

    // After merge, user cart should have lines from both carts
    $this->actingAs($user);
    $cart = $this->getJson('/api/cart');
    $lines = $cart->json('data.lines');
    $this->assertCount(2, $lines,
        'Merged cart should have lines from both guest and user carts');
}
```

- [ ] **Step 2: Executar per verificar que fallen**

```bash
cd /var/www/projecte2/backend
php artisan test --filter="test_guest_cart_is_associated_on_login|test_guest_cart_merges_with_existing_user_cart_on_login"
```

Esperat: **2 FAILED** (l'associació no es fa, el carret guest no té `user_id`).

- [ ] **Step 3: Implementar a AuthController::login()**

Obrir `backend/app/Http/Controllers/Api/AuthController.php`. Afegir IMPORTS al bloc d'use statements (a l'inici del fitxer):

```php
use Lunar\Actions\Carts\AssociateUser;
use Lunar\Models\Cart;
use Lunar\Facades\CartSession;
```

Modificar el mètode `login()`. Trobar la secció DESPRÉS de `$request->session()->regenerate()` i afegir-hi el bloc d'associació del carret guest:

```php
public function login(Request $request)
{
    $credentials = $request->validate([
        'email'    => 'required|email',
        'password' => 'required',
    ]);

    if (! Auth::attempt($credentials)) {
        return response()->json(['message' => 'Credencials incorrectes'], 401);
    }

    $request->session()->regenerate();

    // Associar carret de convidat si s'ha enviat cart_token
    $cartToken = $request->input('cart_token');
    if ($cartToken) {
        $guestCart = Cart::where('meta->token', $cartToken)
            ->whereNull('user_id')
            ->active()
            ->first();

        if ($guestCart) {
            $user = Auth::user();
            $resultCart = app(AssociateUser::class)->execute(
                $guestCart,
                $user,
                config('lunar.cart.auth_policy', 'merge')
            );
            CartSession::use($resultCart);
        }
    }

    return response()->json(['message' => 'Login correcte']);
}
```

**IMPORTANT:** Adaptar el codi al mètode `login()` real del fitxer — no substituir línies de validació o lògica existent. Afegir el bloc de l'if `$cartToken` just DESPRÉS de `$request->session()->regenerate()` i ABANS del `return`.

- [ ] **Step 4: Executar els tests per verificar que passen**

```bash
cd /var/www/projecte2/backend
php artisan test --filter="test_guest_cart_is_associated_on_login|test_guest_cart_merges_with_existing_user_cart_on_login"
```

Esperat: **2 passed**

- [ ] **Step 5: Executar tota la suite**

```bash
cd /var/www/projecte2/backend
php artisan test
```

Esperat: tot verd. Si algun test de carret falla, NO continuar — investigar.

- [ ] **Step 6: Commit**

```bash
cd /var/www/projecte2
git add backend/app/Http/Controllers/Api/AuthController.php backend/tests/Feature/Cart/CartTest.php
git commit -m "feat: associar carret de convidat amb usuari en fer login

Si el frontend envia cart_token al payload del login, el backend
cerca el carret guest i el associa amb l'usuari via AssociateUser::execute()
DESPRÉS de session()->regenerate() per evitar la race condition del listener."
```

---

## Task 8: Backend — Associar carret de convidat en fer register

**Files:**
- Modify: `backend/app/Http/Controllers/Api/AuthController.php`
- Test: `backend/tests/Feature/Cart/CartTest.php`

### Què canvia

El mateix patró que Task 7, però per `AuthController::register()`. Un nou usuari que s'acaba de registrar hauria de veure el carret que havia omplert com a convidat.

- [ ] **Step 1: Escriure el test que falla**

Afegir a `backend/tests/Feature/Cart/CartTest.php`:

```php
public function test_guest_cart_is_associated_on_register(): void
{
    $variant = $this->createVariant();

    // Create a guest cart
    $guestCart = \Lunar\Models\Cart::factory()->create([
        'meta' => ['token' => 'guest-token-register'],
    ]);
    $guestCart->lines()->create([
        'purchasable_type' => \Lunar\Models\ProductVariant::class,
        'purchasable_id'   => $variant->id,
        'quantity'         => 1,
        'meta'             => null,
    ]);

    // Register with cart_token in payload
    $response = $this->postJson('/api/register', [
        'name'                  => 'Test User',
        'email'                 => 'newuser@test.com',
        'password'              => 'password123',
        'password_confirmation' => 'password123',
        'cart_token'            => 'guest-token-register',
    ]);
    $response->assertStatus(201);

    // Guest cart should now be associated with the new user
    $guestCart->refresh();
    $this->assertNotNull($guestCart->user_id,
        'Guest cart should be associated with new user after register');

    // GET /api/cart should return the cart with the original lines
    $newUser = \App\Models\User::where('email', 'newuser@test.com')->first();
    $this->actingAs($newUser);
    $cart = $this->getJson('/api/cart');
    $this->assertNotEmpty($cart->json('data.lines'),
        'Cart should contain guest lines after register');
}
```

- [ ] **Step 2: Executar per verificar que falla**

```bash
cd /var/www/projecte2/backend
php artisan test --filter=test_guest_cart_is_associated_on_register
```

Esperat: **FAIL**

- [ ] **Step 3: Implementar a AuthController::register()**

Obrir `backend/app/Http/Controllers/Api/AuthController.php`. Modificar el mètode `register()` per afegir el bloc d'associació de carret guest JUST ABANS del `return`, usant el mateix patró que `login()`:

```php
// Associar carret de convidat si s'ha enviat cart_token
$cartToken = $request->input('cart_token');
if ($cartToken) {
    $guestCart = Cart::where('meta->token', $cartToken)
        ->whereNull('user_id')
        ->active()
        ->first();

    if ($guestCart) {
        $resultCart = app(AssociateUser::class)->execute(
            $guestCart,
            $user,
            config('lunar.cart.auth_policy', 'merge')
        );
        CartSession::use($resultCart);
    }
}
```

On `$user` és la variable que ja existeix al `register()` amb l'usuari recen creat. Adaptar al codi real del mètode.

**NOTA:** Les dependències `use` ja estaran afegides des de Task 7. No duplicar.

- [ ] **Step 4: Executar els tests per verificar que passen**

```bash
cd /var/www/projecte2/backend
php artisan test --filter=test_guest_cart_is_associated_on_register
```

Esperat: **PASS**

- [ ] **Step 5: Executar tota la suite**

```bash
cd /var/www/projecte2/backend
php artisan test
```

Esperat: tot verd.

- [ ] **Step 6: Commit**

```bash
cd /var/www/projecte2
git add backend/app/Http/Controllers/Api/AuthController.php backend/tests/Feature/Cart/CartTest.php
git commit -m "feat: associar carret de convidat amb usuari en fer register

Mateix patró que login: si frontend envia cart_token al payload
del register, s'associa el carret guest amb el nou usuari."
```

---

## Task 9: Frontend — Enviar `cart_token` en login i register

**Files:**
- Modify: `frontend/src/services/api.js`
- Modify: `frontend/src/context/auth-context.jsx`
- Test: `frontend/src/__tests__/context/cart-context.test.jsx` (o crear `auth-context.test.jsx`)

### Què canvia

- `api.js`: Les funcions `login()` i `register()` accepten un `cartToken` opcional i l'inclouen al payload.
- `auth-context.jsx`: Les funcions `login()` i `register()` llegeixen `cart_token` del `localStorage` i el passen a `api.login()` / `api.register()`. Un cop completat l'auth amb èxit, eliminen `cart_token` del `localStorage` (ja no és necessari: el carret ara pertany a l'usuari i es recupera per `user_id`).

- [ ] **Step 1: Llegir els fitxers actuals**

Llegir `frontend/src/services/api.js` i `frontend/src/context/auth-context.jsx` sencers per entendre l'estructura actual.

- [ ] **Step 2: Modificar `api.js`**

Trobar les funcions `login()` i `register()` a `frontend/src/services/api.js`. Afegir `cartToken` com a paràmetre opcional i incloure'l al payload si existeix:

```js
// Abans:
login: (email, password) =>
  api.post('/login', { email, password }),

register: (name, email, password) =>
  api.post('/register', { name, email, password, password_confirmation: password }),

// Després:
login: (email, password, cartToken = null) =>
  api.post('/login', {
    email,
    password,
    ...(cartToken ? { cart_token: cartToken } : {}),
  }),

register: (name, email, password, cartToken = null) =>
  api.post('/register', {
    name,
    email,
    password,
    password_confirmation: password,
    ...(cartToken ? { cart_token: cartToken } : {}),
  }),
```

Adaptar l'estructura exacta al codi real del fitxer.

- [ ] **Step 3: Modificar `auth-context.jsx`**

Trobar les funcions `login()` i `register()` a `frontend/src/context/auth-context.jsx`. Afegir:
1. Lectura de `cart_token` del `localStorage` ABANS de cridar l'API
2. Passar `cartToken` a la crida de l'API
3. Eliminar `cart_token` del `localStorage` DESPRÉS d'un login/register exitós

```jsx
const login = async (email, password) => {
  const cartToken = localStorage.getItem('cart_token')  // Llegir ABANS de cridar l'API
  const response = await api.login(email, password, cartToken)
  // ... gestió de l'estat d'auth (el que ja hi havia)
  localStorage.removeItem('cart_token')  // Ja no cal: el carret és de l'usuari
  return response
}

const register = async (name, email, password) => {
  const cartToken = localStorage.getItem('cart_token')  // Llegir ABANS de cridar l'API
  const response = await api.register(name, email, password, cartToken)
  // ... gestió de l'estat d'auth (el que ja hi havia)
  localStorage.removeItem('cart_token')  // Ja no cal: el carret és de l'usuari
  return response
}
```

Adaptar al codi real del fitxer. No canviar cap altra lògica.

**IMPORTANT:** Llegir `cart_token` ABANS de la crida async (no després), perquè `cart-context.jsx` pot eliminar-lo en resposta a un canvi d'estat intermedi.

- [ ] **Step 4: Executar els tests frontend**

```bash
cd /var/www/projecte2/frontend
npm test
```

Esperat: tot verd (els tests existents no haurien de trencar-se perquè el `cartToken` és opcional i `localStorage` és buit als tests).

- [ ] **Step 5: Test manual al navegador**

1. Obrir navegador en mode incògnit (sense cookies ni localStorage)
2. Afegir 2 productes al carret (mode convidat)
3. Verificar que `cart_token` existeix al `localStorage` (DevTools → Application → Local Storage)
4. Fer login
5. Verificar que el carret mostra els 2 productes
6. Verificar que `cart_token` ja NO existeix al `localStorage`
7. Fer logout → carret buit
8. Fer login de nou → carret restaurat (ara per `user_id`, no per token)

- [ ] **Step 6: Commit**

```bash
cd /var/www/projecte2
git add frontend/src/services/api.js frontend/src/context/auth-context.jsx
git commit -m "feat: enviar cart_token en login/register per associar carret de convidat

El frontend llegeix cart_token del localStorage i l'envia al backend
durant login i register. Un cop completat l'auth, cart_token s'elimina
del localStorage perquè el carret ja pertany a l'usuari."
```

---

## Task 6: Verificació final completa + push

- [ ] **Step 1: Executar tota la suite backend**

```bash
cd /var/www/projecte2/backend
php artisan test
```

Esperat: tot verd (62+ tests).

- [ ] **Step 2: Executar tota la suite frontend**

```bash
cd /var/www/projecte2/frontend
npm test
```

Esperat: tot verd (9+ passed, 12+ todo).

- [ ] **Step 3: Test manual al navegador — flux complet**

**Escenari A: Usuari registrat (re-login restoration)**
1. Obre `http://51.195.202.7:3000` (o la URL del frontend)
2. Fes login amb un usuari existent
3. Afegeix 2 productes al carret
4. Verifica que el carret mostra 2 items
5. Fes logout → carret buit
6. Fes login de nou → carret restaura amb els 2 items ← **AQUÍ ÉS ON FALLAVA ABANS**

**Escenari B: Flux complet guest→login (Tasks 7-9)**
1. Obre una finestra incògnit (sense cookies ni localStorage)
2. **Sense** fer login, afegeix 2 productes al carret
3. Verifica que `cart_token` existeix al localStorage (DevTools → Application → Local Storage)
4. Fes login → el carret hauria de mantenir els 2 productes
5. Verifica que `cart_token` **ja NO** existeix al localStorage
6. Fes logout → carret buit
7. Fes login de nou → carret restaura amb els 2 items (ara per `user_id`)

**Escenari C: Isolació cross-user**
1. Fes login com a Usuari A, afegeix 1 producte, fes logout
2. Fes login com a Usuari B → carret buit (no veu el carret d'Usuari A)

- [ ] **Step 4: Push a develop i main**

```bash
cd /var/www/projecte2
git push origin develop
git checkout main && git merge develop && git push origin main && git checkout develop
```

---

## Resum de canvis per fitxer

| Fitxer | Task | Canvi |
|--------|------|-------|
| `backend/app/Http/Controllers/Api/CartController.php` | 1 | Afegir fallback `user_id` a `getCartByTokenOrSession()` |
| `backend/app/Http/Controllers/Api/AuthController.php` | 2, 7, 8 | Eliminar `CartSession::forget()` redundant; afegir associació guest cart en login i register |
| `backend/tests/Feature/Cart/CartTest.php` | 1, 3, 7, 8 | Actualitzar + afegir tests de persistència i associació |
| `frontend/src/__tests__/context/cart-context.test.jsx` | 4 | Test que fetchCart es crida en login |
| `frontend/src/context/cart-context.jsx` | 5 | Netejar console.logs |
| `frontend/src/services/api.js` | 9 | Afegir `cartToken` opcional a `login()` i `register()` |
| `frontend/src/context/auth-context.jsx` | 9 | Llegir i enviar `cart_token` en login/register; netejar localStorage |

## Dependències entre tasks

```
Task 1 (fallback user_id) ← CRÍTIC per re-login restoration
  └→ Task 2 (netejar logout) — independent, pot anar en paral·lel
  └→ Task 3 (tests integració) — depèn de Task 1
  └→ Task 4 (test frontend) — independent de Task 1-3
  └→ Task 5 (netejar logs) — independent

Task 7 (guest cart en login) ← CRÍTIC per flux guest→user
  └→ Task 8 (guest cart en register) — independent de Task 7
  └→ Task 9 (frontend cart_token) — depèn de Tasks 7 i 8 (backend ha d'acceptar el camp primer)

Task 6 (verificació final) ← depèn de TOTS els anteriors (Tasks 1-5, 7-9)
```

**Ordre recomanat d'implementació:**
1. Task 1 (fallback user_id) — desbloqueja Tasks 3 i el test manual de re-login
2. Task 7 (login association) + Task 2 (netejar logout) — en paral·lel
3. Task 8 (register association)
4. Task 9 (frontend cart_token) — un cop backend accepta el camp
5. Tasks 3, 4, 5 — tests i cleanup
6. Task 6 (verificació final)
