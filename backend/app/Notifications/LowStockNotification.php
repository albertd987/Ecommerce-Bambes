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
