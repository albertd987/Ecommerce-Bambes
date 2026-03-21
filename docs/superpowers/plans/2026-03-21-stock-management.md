# Stock Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement real stock management with movement history, alerts, qualitative frontend indicators, and admin stock management UI.

**Architecture:** New `stock_movements` table tracks every stock change. A centralized `StockService` is the single entry point for all stock mutations. Events + listeners handle low-stock alerts. The API returns `stock_status` (in_stock/low_stock/out_of_stock) instead of exact numbers. Filament admin gets a Stock tab with adjustment modal and movement history.

**Tech Stack:** Laravel 11, Lunar, Filament, PHPUnit, React 18, i18next

**Spec:** `docs/superpowers/specs/2026-03-21-stock-management-design.md`

---

## File Structure

### Backend — New Files
| File | Responsibility |
|------|----------------|
| `database/migrations/2026_03_21_000001_create_stock_movements_table.php` | Schema for stock_movements table |
| `app/Models/StockMovement.php` | Eloquent model for stock movements |
| `app/Services/StockService.php` | Centralized stock mutation logic |
| `app/Events/StockUpdated.php` | Event dispatched after each stock change |
| `app/Listeners/CheckLowStock.php` | Listener that checks thresholds and notifies |
| `app/Notifications/LowStockNotification.php` | Email + Filament notification |
| `config/stock.php` | Stock configuration (low_threshold = 10) |
| `tests/Unit/StockServiceTest.php` | Unit tests for StockService |
| `tests/Feature/Stock/StockMovementTest.php` | Feature tests for stock flow |

### Backend — Modified Files
| File | Change |
|------|--------|
| `app/Http/Controllers/Api/CheckoutController.php:284` | Use StockService::sell() instead of direct decrement |
| `app/Http/Controllers/Api/ProductController.php:268` | Return stock_status instead of stock number |
| `app/Services/SimpleProductCreator.php:190-191,257-258` | Use StockService::setInitial(), change purchasable to 'in_stock' |
| `app/Providers/EventServiceProvider.php` (or bootstrap) | Register StockUpdated → CheckLowStock |
| `app/Filament/Lunar/Extensions/ProductResourceExtension.php` | Add Stock tab with adjustment modal + history |

### Frontend — Modified Files
| File | Change |
|------|--------|
| `src/pages/ProductDetailPage.jsx:268,447-481,488-495` | Use stock_status indicators instead of stock number |
| `src/components/ProductCard.jsx` | Add "Esgotat" badge |
| `src/locales/ca.json` | Update stock translation keys |
| `src/locales/en.json` | Update stock translation keys |

---

## Task 1: Migration + Model StockMovement

**Files:**
- Create: `backend/database/migrations/2026_03_21_000001_create_stock_movements_table.php`
- Create: `backend/app/Models/StockMovement.php`

- [ ] **Step 1: Create migration**

```bash
cd /var/www/projecte2/backend && php artisan make:migration create_stock_movements_table
```

Then replace the content with:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('stock_movements', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('product_variant_id');
            $table->integer('quantity'); // positive = in, negative = out
            $table->string('type'); // sale, cancellation, return, adjustment, reception, initial
            $table->string('reference')->nullable();
            $table->text('notes')->nullable();
            $table->unsignedBigInteger('user_id')->nullable();
            $table->timestamp('created_at');

            $table->foreign('product_variant_id')
                  ->references('id')
                  ->on('lunar_product_variants')
                  ->onDelete('cascade');

            $table->foreign('user_id')
                  ->references('id')
                  ->on('users')
                  ->onDelete('set null');

            $table->index(['product_variant_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('stock_movements');
    }
};
```

- [ ] **Step 2: Create StockMovement model**

Create `backend/app/Models/StockMovement.php`:

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Lunar\Models\ProductVariant;

class StockMovement extends Model
{
    const UPDATED_AT = null;

    protected $fillable = [
        'product_variant_id',
        'quantity',
        'type',
        'reference',
        'notes',
        'user_id',
    ];

    protected $casts = [
        'quantity' => 'integer',
        'created_at' => 'datetime',
    ];

    public const TYPE_SALE = 'sale';
    public const TYPE_CANCELLATION = 'cancellation';
    public const TYPE_RETURN = 'return';
    public const TYPE_ADJUSTMENT = 'adjustment';
    public const TYPE_RECEPTION = 'reception';
    public const TYPE_INITIAL = 'initial';

    public const TYPES = [
        self::TYPE_SALE,
        self::TYPE_CANCELLATION,
        self::TYPE_RETURN,
        self::TYPE_ADJUSTMENT,
        self::TYPE_RECEPTION,
        self::TYPE_INITIAL,
    ];

    public function variant()
    {
        return $this->belongsTo(ProductVariant::class, 'product_variant_id');
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
```

- [ ] **Step 3: Run migration**

```bash
cd /var/www/projecte2/backend && php artisan migrate
```

- [ ] **Step 4: Commit**

```bash
git add backend/database/migrations/*_create_stock_movements_table.php backend/app/Models/StockMovement.php
git commit -m "feat: add stock_movements table and StockMovement model"
```

---

## Task 2: Config + Event + StockService

**Files:**
- Create: `backend/config/stock.php`
- Create: `backend/app/Events/StockUpdated.php`
- Create: `backend/app/Services/StockService.php`

- [ ] **Step 1: Create config file**

Create `backend/config/stock.php`:

```php
<?php

return [
    'low_threshold' => (int) env('STOCK_LOW_THRESHOLD', 10),
    'admin_email' => env('STOCK_ADMIN_EMAIL'),
];
```

- [ ] **Step 2: Create StockUpdated event**

Create `backend/app/Events/StockUpdated.php`:

```php
<?php

namespace App\Events;

use App\Models\StockMovement;
use Illuminate\Foundation\Events\Dispatchable;
use Lunar\Models\ProductVariant;

class StockUpdated
{
    use Dispatchable;

    public function __construct(
        public readonly ProductVariant $variant,
        public readonly StockMovement $movement,
        public readonly int $previousStock,
    ) {}
}
```

- [ ] **Step 3: Create StockService**

Create `backend/app/Services/StockService.php`:

```php
<?php

namespace App\Services;

use App\Events\StockUpdated;
use App\Models\StockMovement;
use Illuminate\Support\Facades\DB;
use Lunar\Models\ProductVariant;

class StockService
{
    /**
     * Core method: create a stock movement and update variant stock.
     *
     * @throws \InvalidArgumentException if resulting stock would be negative
     */
    public function move(
        ProductVariant $variant,
        int $quantity,
        string $type,
        ?string $reference = null,
        ?string $notes = null,
        ?int $userId = null,
    ): StockMovement {
        if (! in_array($type, StockMovement::TYPES)) {
            throw new \InvalidArgumentException("Invalid stock movement type: {$type}");
        }

        return DB::transaction(function () use ($variant, $quantity, $type, $reference, $notes, $userId) {
            $variant = ProductVariant::lockForUpdate()->find($variant->id);

            $previousStock = $variant->stock;
            $newStock = $previousStock + $quantity;

            if ($newStock < 0 && $variant->purchasable !== 'always') {
                throw new \InvalidArgumentException(
                    "Insufficient stock for variant {$variant->id}. Current: {$previousStock}, requested: {$quantity}"
                );
            }

            $movement = StockMovement::create([
                'product_variant_id' => $variant->id,
                'quantity' => $quantity,
                'type' => $type,
                'reference' => $reference,
                'notes' => $notes,
                'user_id' => $userId,
            ]);

            $variant->update(['stock' => $newStock]);

            StockUpdated::dispatch($variant, $movement, $previousStock);

            return $movement;
        });
    }

    public function sell(ProductVariant $variant, int $qty, int|string $orderId): StockMovement
    {
        return $this->move($variant, -$qty, StockMovement::TYPE_SALE, "order:{$orderId}");
    }

    public function cancel(ProductVariant $variant, int $qty, int|string $orderId): StockMovement
    {
        return $this->move($variant, $qty, StockMovement::TYPE_CANCELLATION, "order:{$orderId}");
    }

    public function returnStock(ProductVariant $variant, int $qty, int|string $orderId): StockMovement
    {
        return $this->move($variant, $qty, StockMovement::TYPE_RETURN, "order:{$orderId}");
    }

    public function adjust(ProductVariant $variant, int $qty, ?string $notes, ?int $userId): StockMovement
    {
        return $this->move($variant, $qty, StockMovement::TYPE_ADJUSTMENT, null, $notes, $userId);
    }

    public function receive(ProductVariant $variant, int $qty, ?string $notes, ?int $userId): StockMovement
    {
        return $this->move($variant, $qty, StockMovement::TYPE_RECEPTION, null, $notes, $userId);
    }

    public function setInitial(ProductVariant $variant, int $qty, ?int $userId = null): StockMovement
    {
        if ($variant->stockMovements()->exists()) {
            throw new \InvalidArgumentException(
                "Variant {$variant->id} already has stock movements. Use adjust() instead."
            );
        }

        return $this->move($variant, $qty, StockMovement::TYPE_INITIAL, null, null, $userId);
    }

    /**
     * Get qualitative stock status for API responses.
     */
    public static function getStatus(ProductVariant $variant): string
    {
        if ($variant->stock <= 0) {
            return 'out_of_stock';
        }

        if ($variant->stock <= config('stock.low_threshold', 10)) {
            return 'low_stock';
        }

        return 'in_stock';
    }
}
```

- [ ] **Step 4: Add stockMovements relation to ProductVariant**

Since we can't modify Lunar's ProductVariant model directly, we need a runtime relationship. Add it via the `AppServiceProvider` boot method. Check `backend/app/Providers/AppServiceProvider.php` and add:

```php
use Lunar\Models\ProductVariant;
use App\Models\StockMovement;

// In boot():
ProductVariant::resolveRelationUsing('stockMovements', function ($model) {
    return $model->hasMany(StockMovement::class, 'product_variant_id');
});
```

- [ ] **Step 5: Commit**

```bash
git add backend/config/stock.php backend/app/Events/StockUpdated.php backend/app/Services/StockService.php backend/app/Providers/AppServiceProvider.php
git commit -m "feat: add StockService, StockUpdated event, and stock config"
```

---

## Task 3: Unit Tests for StockService

**Files:**
- Create: `backend/tests/Unit/StockServiceTest.php`

- [ ] **Step 1: Write StockService unit tests**

Create `backend/tests/Unit/StockServiceTest.php`:

```php
<?php

namespace Tests\Unit;

use App\Models\StockMovement;
use App\Services\StockService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Lunar\Models\ProductVariant;
use Tests\TestCase;
use Tests\Traits\LunarTestSetup;

class StockServiceTest extends TestCase
{
    use RefreshDatabase, LunarTestSetup;

    private StockService $stockService;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpLunar();
        $this->stockService = new StockService();
    }

    public function test_move_creates_movement_and_updates_stock(): void
    {
        ['variant' => $variant] = $this->createProductWithVariantAndPrice(stock: 20);

        $movement = $this->stockService->move($variant, -5, StockMovement::TYPE_SALE, 'order:1');

        $this->assertDatabaseHas('stock_movements', [
            'product_variant_id' => $variant->id,
            'quantity' => -5,
            'type' => 'sale',
            'reference' => 'order:1',
        ]);

        $variant->refresh();
        $this->assertEquals(15, $variant->stock);
    }

    public function test_move_throws_on_negative_stock_when_purchasable_in_stock(): void
    {
        ['variant' => $variant] = $this->createProductWithVariantAndPrice(stock: 3);
        $variant->update(['purchasable' => 'in_stock']);

        $this->expectException(\InvalidArgumentException::class);
        $this->stockService->move($variant, -5, StockMovement::TYPE_SALE);
    }

    public function test_move_allows_negative_stock_when_purchasable_always(): void
    {
        ['variant' => $variant] = $this->createProductWithVariantAndPrice(stock: 3);
        $variant->update(['purchasable' => 'always']);

        $movement = $this->stockService->move($variant, -5, StockMovement::TYPE_SALE);

        $variant->refresh();
        $this->assertEquals(-2, $variant->stock);
    }

    public function test_move_throws_on_invalid_type(): void
    {
        ['variant' => $variant] = $this->createProductWithVariantAndPrice(stock: 10);

        $this->expectException(\InvalidArgumentException::class);
        $this->stockService->move($variant, 5, 'invalid_type');
    }

    public function test_sell_creates_negative_movement(): void
    {
        ['variant' => $variant] = $this->createProductWithVariantAndPrice(stock: 10);

        $movement = $this->stockService->sell($variant, 3, 42);

        $this->assertEquals(-3, $movement->quantity);
        $this->assertEquals('sale', $movement->type);
        $this->assertEquals('order:42', $movement->reference);

        $variant->refresh();
        $this->assertEquals(7, $variant->stock);
    }

    public function test_cancel_restores_stock(): void
    {
        ['variant' => $variant] = $this->createProductWithVariantAndPrice(stock: 7);

        $movement = $this->stockService->cancel($variant, 3, 42);

        $this->assertEquals(3, $movement->quantity);
        $this->assertEquals('cancellation', $movement->type);

        $variant->refresh();
        $this->assertEquals(10, $variant->stock);
    }

    public function test_return_stock_restores_stock(): void
    {
        ['variant' => $variant] = $this->createProductWithVariantAndPrice(stock: 7);

        $movement = $this->stockService->returnStock($variant, 2, 42);

        $this->assertEquals(2, $movement->quantity);
        $this->assertEquals('return', $movement->type);

        $variant->refresh();
        $this->assertEquals(9, $variant->stock);
    }

    public function test_adjust_can_increase_or_decrease(): void
    {
        ['variant' => $variant] = $this->createProductWithVariantAndPrice(stock: 10);

        $this->stockService->adjust($variant, 5, 'Received extra', 1);
        $variant->refresh();
        $this->assertEquals(15, $variant->stock);

        $this->stockService->adjust($variant, -3, 'Damaged items', 1);
        $variant->refresh();
        $this->assertEquals(12, $variant->stock);
    }

    public function test_receive_adds_stock(): void
    {
        ['variant' => $variant] = $this->createProductWithVariantAndPrice(stock: 5);

        $movement = $this->stockService->receive($variant, 20, 'New shipment', 1);

        $this->assertEquals(20, $movement->quantity);
        $this->assertEquals('reception', $movement->type);

        $variant->refresh();
        $this->assertEquals(25, $variant->stock);
    }

    public function test_set_initial_works_on_new_variant(): void
    {
        ['variant' => $variant] = $this->createProductWithVariantAndPrice(stock: 0);

        $movement = $this->stockService->setInitial($variant, 50);

        $this->assertEquals(50, $movement->quantity);
        $this->assertEquals('initial', $movement->type);

        $variant->refresh();
        $this->assertEquals(50, $variant->stock);
    }

    public function test_set_initial_throws_if_variant_has_movements(): void
    {
        ['variant' => $variant] = $this->createProductWithVariantAndPrice(stock: 0);

        $this->stockService->setInitial($variant, 50);

        $this->expectException(\InvalidArgumentException::class);
        $this->stockService->setInitial($variant, 10);
    }

    public function test_get_status_returns_correct_status(): void
    {
        ['variant' => $variant] = $this->createProductWithVariantAndPrice(stock: 20);
        $this->assertEquals('in_stock', StockService::getStatus($variant));

        $variant->update(['stock' => 10]);
        $variant->refresh();
        $this->assertEquals('low_stock', StockService::getStatus($variant));

        $variant->update(['stock' => 5]);
        $variant->refresh();
        $this->assertEquals('low_stock', StockService::getStatus($variant));

        $variant->update(['stock' => 0]);
        $variant->refresh();
        $this->assertEquals('out_of_stock', StockService::getStatus($variant));
    }

    public function test_move_dispatches_stock_updated_event(): void
    {
        \Illuminate\Support\Facades\Event::fake([\App\Events\StockUpdated::class]);

        ['variant' => $variant] = $this->createProductWithVariantAndPrice(stock: 10);

        $this->stockService->move($variant, -2, StockMovement::TYPE_SALE);

        \Illuminate\Support\Facades\Event::assertDispatched(\App\Events\StockUpdated::class, function ($event) use ($variant) {
            return $event->variant->id === $variant->id
                && $event->previousStock === 10
                && $event->movement->quantity === -2;
        });
    }
}
```

- [ ] **Step 2: Run tests to verify they fail (model/service not yet wired)**

```bash
cd /var/www/projecte2/backend && php artisan test tests/Unit/StockServiceTest.php --stop-on-failure
```

Expected: Tests should pass since we already created model and service in Tasks 1-2. If any fail, fix the issue.

- [ ] **Step 3: Run tests to verify all pass**

```bash
cd /var/www/projecte2/backend && php artisan test tests/Unit/StockServiceTest.php -v
```

Expected: All 12 tests PASS.

- [ ] **Step 4: Commit**

```bash
git add backend/tests/Unit/StockServiceTest.php
git commit -m "test: add StockService unit tests"
```

---

## Task 4: Low Stock Alerts (Listener + Notification)

**Files:**
- Create: `backend/app/Listeners/CheckLowStock.php`
- Create: `backend/app/Notifications/LowStockNotification.php`
- Modify: `backend/app/Providers/AppServiceProvider.php` (register event listener)

- [ ] **Step 1: Create LowStockNotification**

Create `backend/app/Notifications/LowStockNotification.php`:

```php
<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use Lunar\Models\ProductVariant;

class LowStockNotification extends Notification
{
    use Queueable;

    public function __construct(
        public readonly ProductVariant $variant,
        public readonly int $currentStock,
    ) {}

    public function via(object $notifiable): array
    {
        return ['mail', 'database'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $productName = $this->variant->product?->translateAttribute('name') ?? 'Unknown';
        $sku = $this->variant->sku;

        return (new MailMessage)
            ->subject("⚠ Stock baix: {$productName} ({$sku})")
            ->greeting("Alerta d'stock baix")
            ->line("El producte **{$productName}** (SKU: {$sku}) té només **{$this->currentStock} unitats** en stock.")
            ->line("Considera reposar l'stock aviat.")
            ->action('Veure producte al panel', url("/lunar/{$this->variant->product_id}"));
    }

    public function toArray(object $notifiable): array
    {
        $productName = $this->variant->product?->translateAttribute('name') ?? 'Unknown';

        return [
            'title' => "Stock baix: {$productName}",
            'message' => "Només queden {$this->currentStock} unitats (SKU: {$this->variant->sku})",
            'variant_id' => $this->variant->id,
            'product_id' => $this->variant->product_id,
            'stock' => $this->currentStock,
        ];
    }
}
```

- [ ] **Step 2: Create CheckLowStock listener**

Create `backend/app/Listeners/CheckLowStock.php`:

```php
<?php

namespace App\Listeners;

use App\Events\StockUpdated;
use App\Models\User;
use App\Notifications\LowStockNotification;

class CheckLowStock
{
    public function handle(StockUpdated $event): void
    {
        $threshold = config('stock.low_threshold', 10);
        $currentStock = $event->variant->stock;
        $previousStock = $event->previousStock;

        // Only notify when crossing the threshold downward
        if ($currentStock <= $threshold && $previousStock > $threshold) {
            $this->notifyAdmins($event);
        }
    }

    private function notifyAdmins(StockUpdated $event): void
    {
        $adminEmail = config('stock.admin_email');

        if (! $adminEmail) {
            return;
        }

        $admin = User::where('email', $adminEmail)->first();

        if ($admin) {
            $admin->notify(new LowStockNotification(
                $event->variant->load('product'),
                $event->variant->stock,
            ));
        }
    }
}
```

- [ ] **Step 3: Create notifications table migration**

The `database` notification channel requires a `notifications` table:

```bash
cd /var/www/projecte2/backend && php artisan notifications:table && php artisan migrate
```

- [ ] **Step 4: Register event → listener in AppServiceProvider**

Add to `backend/app/Providers/AppServiceProvider.php` boot method:

```php
use Illuminate\Support\Facades\Event;
use App\Events\StockUpdated;
use App\Listeners\CheckLowStock;

// In boot():
Event::listen(StockUpdated::class, CheckLowStock::class);
```

- [ ] **Step 5: Commit**

```bash
git add backend/app/Listeners/CheckLowStock.php backend/app/Notifications/LowStockNotification.php backend/app/Providers/AppServiceProvider.php
git commit -m "feat: add low stock alerts via event listener + notification"
```

---

## Task 5: Refactor CheckoutController to use StockService

**Files:**
- Modify: `backend/app/Http/Controllers/Api/CheckoutController.php:284`
- Test: `backend/tests/Feature/Checkout/CheckoutTest.php`

- [ ] **Step 1: Read the current CheckoutController confirm() method**

Read `backend/app/Http/Controllers/Api/CheckoutController.php` around line 254-290 to understand the full context of the stock decrement loop.

- [ ] **Step 2: Replace direct decrement with StockService::sell()**

In `CheckoutController.php`, add the import at top:

```php
use App\Services\StockService;
```

Replace line 284 (`$variant->decrement('stock', $qty);`) with:

```php
app(StockService::class)->sell($variant, $qty, $orderId);
```

Note: the order ID is stored in `$orderId` (from `DB::table('lunar_orders')->insertGetId(...)` at line 196), NOT `$order->id`.

- [ ] **Step 3: Investigate and fix the stock decrement bug**

The user reported stock doesn't decrement on purchase. Read the full `confirm()` method to understand the flow. Common causes:
- The decrement loop might be skipped due to an early return
- The order lines might not be fetched correctly
- The variant might not be loaded correctly

Debug by tracing the exact execution path.

- [ ] **Step 4: Run existing checkout tests**

```bash
cd /var/www/projecte2/backend && php artisan test tests/Feature/Checkout/CheckoutTest.php -v
```

- [ ] **Step 5: Commit**

```bash
git add backend/app/Http/Controllers/Api/CheckoutController.php
git commit -m "refactor: use StockService::sell() in CheckoutController"
```

---

## Task 6: Refactor SimpleProductCreator to use StockService

**Files:**
- Modify: `backend/app/Services/SimpleProductCreator.php:190-191,257-258,142`

- [ ] **Step 1: Read SimpleProductCreator**

Read the full file to understand the create flow and where stock is set.

- [ ] **Step 2: Modify create() — simple variant path (line ~190)**

Add import:
```php
use App\Services\StockService;
```

In `createSimpleVariant()`, change the variant creation to set `stock: 0` initially and `purchasable: 'in_stock'`, then call StockService after:

Replace:
```php
'stock' => (int) ($data['stock'] ?? 0),
'purchasable' => 'always',
```

With:
```php
'stock' => 0,
'purchasable' => 'in_stock',
```

Then after the variant is created, add:
```php
$stock = (int) ($data['stock'] ?? 0);
if ($stock > 0) {
    app(StockService::class)->setInitial($variant, $stock);
}
```

- [ ] **Step 3: Modify create() — variants with options path (line ~257)**

Same pattern: set `stock: 0, purchasable: 'in_stock'` in create, then call `setInitial()` after.

- [ ] **Step 4: Modify update() — stock update (line ~142)**

Replace direct `$firstVariant->update(['stock' => ...])` with:
```php
app(StockService::class)->adjust($firstVariant, (int) $data['stock'] - $firstVariant->stock, 'Stock update via admin');
```

- [ ] **Step 5: Run existing product tests**

```bash
cd /var/www/projecte2/backend && php artisan test tests/Feature/Products/ProductTest.php -v
```

- [ ] **Step 6: Commit**

```bash
git add backend/app/Services/SimpleProductCreator.php
git commit -m "refactor: use StockService in SimpleProductCreator"
```

---

## Task 7: API — Return stock_status instead of stock number

**Files:**
- Modify: `backend/app/Http/Controllers/Api/ProductController.php:268`

- [ ] **Step 1: Read ProductController show() method**

Read around lines 244-273 to understand the variant mapping.

- [ ] **Step 2: Replace stock with stock_status**

Add import:
```php
use App\Services\StockService;
```

Replace line 268:
```php
'stock' => $variant->stock,
```

With:
```php
'stock_status' => StockService::getStatus($variant),
```

- [ ] **Step 3: Check if stock is returned elsewhere in ProductController**

Verify the `index()` method doesn't return stock (it shouldn't based on exploration).

- [ ] **Step 4: Run product tests**

```bash
cd /var/www/projecte2/backend && php artisan test tests/Feature/Products/ProductTest.php -v
```

- [ ] **Step 5: Commit**

```bash
git add backend/app/Http/Controllers/Api/ProductController.php
git commit -m "feat: return stock_status instead of stock number in API"
```

---

## Task 8: Frontend — Qualitative stock indicators

**Files:**
- Modify: `frontend/src/pages/ProductDetailPage.jsx`
- Modify: `frontend/src/components/ProductCard.jsx`
- Modify: `frontend/src/locales/ca.json`
- Modify: `frontend/src/locales/en.json`

- [ ] **Step 1: Update translation files**

In `frontend/src/locales/ca.json`, replace the stock section (lines ~490-493):

```json
"stock": {
  "in_stock": "En stock",
  "low_stock": "Últimes unitats",
  "out_of_stock": "Esgotat"
}
```

In `frontend/src/locales/en.json`, same replacement:

```json
"stock": {
  "in_stock": "In stock",
  "low_stock": "Last units",
  "out_of_stock": "Out of stock"
}
```

- [ ] **Step 2: Update ProductDetailPage — stock indicator**

Replace the stock display block (lines ~476-481) with:

```jsx
{selectedSize && currentVariant && (
  <p className={`text-sm font-medium mt-2 ${
    currentVariant.stock_status === 'in_stock' ? 'text-green-600' :
    currentVariant.stock_status === 'low_stock' ? 'text-orange-500' :
    'text-red-600'
  }`}>
    {t(`productDetail.stock.${currentVariant.stock_status}`)}
  </p>
)}
```

- [ ] **Step 3: Update ProductDetailPage — out-of-stock logic**

Replace line 274 (`const isOutOfStock = currentVariant && currentVariant.stock <= 0`) with:

```jsx
const isOutOfStock = currentVariant && currentVariant.stock_status === 'out_of_stock'
```

Update size button stock check (line ~447). Change `variant.stock > 0` to use `stock_status`:

```jsx
const hasStock = variant && variant.stock_status !== 'out_of_stock'
```

Update the `handleAddToCart` check (lines ~164-166):

```jsx
if (variant.stock_status === 'out_of_stock') {
  toast.error(t("productDetail.toasts.outOfStock", "No hi ha estoc disponible"))
  return
}
```

- [ ] **Step 4: Update ProductController index() to include stock_status**

This must be done BEFORE updating ProductCard, since the card needs this data from the API.

Add a computed `stock_status` to the product list response. Use `StockService::getStatus()` per variant and pick the worst:

```php
use App\Services\StockService;

// In the product mapping (around line 127-143), add:
'stock_status' => $product->variants->isEmpty()
    ? 'out_of_stock'
    : ($product->variants->every(fn($v) => StockService::getStatus($v) === 'out_of_stock')
        ? 'out_of_stock'
        : 'in_stock'),
```

Note: for the list view, we only show `out_of_stock` vs `in_stock` (no `low_stock`), since the list is a summary view. The detailed status per variant is on the product detail page.

- [ ] **Step 5: Update ProductCard — add "Esgotat" badge**

Now that the API returns `stock_status`, add the badge to ProductCard.

Make the image container `relative`:
```jsx
<div className="relative aspect-square overflow-hidden bg-[#f5f5f5] rounded-lg mb-2">
```

Add after the `<img>` tag, inside the image container:

```jsx
{product.stock_status === 'out_of_stock' && (
  <span className="absolute top-2 left-2 bg-red-600 text-white text-xs font-medium px-2 py-0.5 rounded">
    Esgotat
  </span>
)}
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/ProductDetailPage.jsx frontend/src/components/ProductCard.jsx frontend/src/locales/ca.json frontend/src/locales/en.json backend/app/Http/Controllers/Api/ProductController.php
git commit -m "feat: qualitative stock indicators on frontend (in_stock/low_stock/out_of_stock)"
```

---

## Task 9: Admin — Stock Tab with Filament

**Files:**
- Modify: `backend/app/Filament/Lunar/Extensions/ProductResourceExtension.php`

- [ ] **Step 1: Read the current ProductResourceExtension**

Read the full file to understand how the Filament form and pages are structured.

- [ ] **Step 2: Add Stock RelationManager or Tab**

This requires adding stock management to the product edit page. The approach depends on how Lunar's Filament extension system works. Options:

**Option A: Add a custom Filament page/tab**

Create a new RelationManager or add form components for stock adjustment. The exact approach depends on the Lunar Filament extension API — read `ProductResourceExtension.php` to understand what hooks are available (`extendTable`, `extendForm`, `extendPages`).

**Key UI elements to implement:**

A) **Variants stock table** — showing all variants with current stock:

```php
use Filament\Tables;

Tables\Columns\TextColumn::make('sku')->label('SKU'),
Tables\Columns\TextColumn::make('stock')->label('Stock'),
Tables\Columns\TextColumn::make('stock_status')
    ->label('Estat')
    ->badge()
    ->color(fn (string $state) => match ($state) {
        'in_stock' => 'success',
        'low_stock' => 'warning',
        'out_of_stock' => 'danger',
    }),
```

B) **Adjustment action** — modal for adjusting stock:

```php
Tables\Actions\Action::make('adjust_stock')
    ->label('Ajustar stock')
    ->icon('heroicon-o-adjustments-horizontal')
    ->form([
        Forms\Components\TextInput::make('quantity')
            ->label('Quantitat')
            ->numeric()
            ->required(),
        Forms\Components\Select::make('type')
            ->label('Tipus')
            ->options([
                'adjustment' => 'Ajust',
                'reception' => 'Recepció',
            ])
            ->required(),
        Forms\Components\Textarea::make('notes')
            ->label('Notes')
            ->rows(2),
    ])
    ->action(function (ProductVariant $record, array $data) {
        $service = app(StockService::class);
        $method = $data['type'] === 'reception' ? 'receive' : 'adjust';
        $service->$method($record, (int) $data['quantity'], $data['notes'] ?? null, auth()->id());
    }),
```

C) **Movement history table:**

```php
Tables\Columns\TextColumn::make('created_at')->label('Data')->dateTime(),
Tables\Columns\TextColumn::make('variant.sku')->label('Variant'),
Tables\Columns\TextColumn::make('quantity')->label('Quantitat'),
Tables\Columns\TextColumn::make('type')->label('Tipus')->badge(),
Tables\Columns\TextColumn::make('reference')->label('Referència'),
Tables\Columns\TextColumn::make('user.name')->label('Usuari'),
```

- [ ] **Step 3: Test the admin panel manually**

Navigate to the admin panel and verify:
- Stock tab appears on product edit page
- Variant stock table shows correctly
- Adjustment modal works
- Movement history displays correctly

- [ ] **Step 4: Commit**

```bash
git add backend/app/Filament/
git commit -m "feat: admin stock management tab with adjustment modal and history"
```

---

## Task 10: Feature Tests for Stock Flow

**Files:**
- Create: `backend/tests/Feature/Stock/StockMovementTest.php`

- [ ] **Step 1: Write feature tests**

Create `backend/tests/Feature/Stock/StockMovementTest.php`:

```php
<?php

namespace Tests\Feature\Stock;

use App\Models\StockMovement;
use App\Services\StockService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;
use Tests\Traits\LunarTestSetup;

class StockMovementTest extends TestCase
{
    use RefreshDatabase, LunarTestSetup;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpLunar();
    }

    public function test_product_api_returns_stock_status_not_stock_number(): void
    {
        ['product' => $product] = $this->createProductWithVariantAndPrice(stock: 20);

        $response = $this->getJson("/api/products/{$product->id}");

        $response->assertOk();
        $variant = $response->json('data.variants.0');
        $this->assertArrayHasKey('stock_status', $variant);
        $this->assertArrayNotHasKey('stock', $variant);
        $this->assertEquals('in_stock', $variant['stock_status']);
    }

    public function test_product_api_returns_low_stock_status(): void
    {
        ['product' => $product] = $this->createProductWithVariantAndPrice(stock: 5);

        $response = $this->getJson("/api/products/{$product->id}");

        $response->assertOk();
        $this->assertEquals('low_stock', $response->json('data.variants.0.stock_status'));
    }

    public function test_product_api_returns_out_of_stock_status(): void
    {
        ['product' => $product] = $this->createProductWithVariantAndPrice(stock: 0);

        $response = $this->getJson("/api/products/{$product->id}");

        $response->assertOk();
        $this->assertEquals('out_of_stock', $response->json('data.variants.0.stock_status'));
    }

    public function test_cart_add_still_validates_stock(): void
    {
        ['product' => $product, 'variant' => $variant] = $this->createProductWithVariantAndPrice(stock: 2);

        $response = $this->postJson('/api/cart/add', [
            'variant_id' => $variant->id,
            'quantity' => 5,
        ]);

        $response->assertStatus(400);
        $response->assertJsonFragment(['available_stock' => 2]);
    }

    public function test_stock_movement_history_is_recorded(): void
    {
        ['variant' => $variant] = $this->createProductWithVariantAndPrice(stock: 0);
        $service = app(StockService::class);

        $service->setInitial($variant, 50);
        $service->sell($variant, 3, 1);
        $service->receive($variant, 10, 'New batch', null);

        $movements = StockMovement::where('product_variant_id', $variant->id)
            ->orderBy('created_at')
            ->get();

        $this->assertCount(3, $movements);
        $this->assertEquals('initial', $movements[0]->type);
        $this->assertEquals(50, $movements[0]->quantity);
        $this->assertEquals('sale', $movements[1]->type);
        $this->assertEquals(-3, $movements[1]->quantity);
        $this->assertEquals('reception', $movements[2]->type);
        $this->assertEquals(10, $movements[2]->quantity);

        $variant->refresh();
        $this->assertEquals(57, $variant->stock);
    }
}
```

- [ ] **Step 2: Run all tests**

```bash
cd /var/www/projecte2/backend && php artisan test -v
```

Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add backend/tests/Feature/Stock/StockMovementTest.php
git commit -m "test: add feature tests for stock movement flow"
```

---

## Task 11: Final Verification

- [ ] **Step 1: Run full test suite**

```bash
cd /var/www/projecte2/backend && php artisan test -v
```

- [ ] **Step 2: Verify no direct stock manipulation remains**

Search for any remaining direct stock writes:

```bash
cd /var/www/projecte2/backend && grep -rn "->decrement('stock'" --include="*.php" app/
cd /var/www/projecte2/backend && grep -rn "->increment('stock'" --include="*.php" app/
cd /var/www/projecte2/backend && grep -rn "'stock' =>" --include="*.php" app/Http/ app/Services/
```

The only allowed occurrences should be inside `StockService.php`.

- [ ] **Step 3: Verify API doesn't expose raw stock**

```bash
cd /var/www/projecte2/backend && grep -rn "'stock' =>" --include="*.php" app/Http/Controllers/
```

Should NOT find `'stock' => $variant->stock` — only `'stock_status'`.

- [ ] **Step 4: Commit any final fixes**

```bash
git add -A && git commit -m "chore: final cleanup for stock management feature"
```
