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
