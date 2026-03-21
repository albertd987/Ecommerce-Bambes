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
