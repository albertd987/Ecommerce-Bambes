<?php

namespace App\Services;

use App\Events\StockUpdated;
use App\Models\StockMovement;
use Illuminate\Support\Facades\DB;
use Lunar\Models\ProductVariant;

class StockService
{
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
