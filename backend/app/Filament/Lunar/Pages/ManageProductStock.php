<?php

namespace App\Filament\Lunar\Pages;

use App\Models\StockMovement;
use App\Services\StockService;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\Textarea;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Concerns\InteractsWithForms;
use Filament\Forms\Contracts\HasForms;
use Filament\Forms\Form;
use Filament\Notifications\Notification;
use Filament\Resources\Pages\Concerns\InteractsWithRecord;
use Filament\Resources\Pages\Page;
use Illuminate\Contracts\Support\Htmlable;
use Lunar\Admin\Filament\Resources\ProductResource;
use Lunar\Models\ProductVariant;

class ManageProductStock extends Page implements HasForms
{
    use InteractsWithForms;
    use InteractsWithRecord;

    protected static string $resource = ProductResource::class;

    protected static string $view = 'filament.pages.manage-product-stock';

    public array $adjustData = [];

    public ?int $selectedVariantId = null;

    public function mount(int|string $record): void
    {
        $this->record = $this->resolveRecord($record);
    }

    public function getTitle(): string|Htmlable
    {
        return 'Gestió d\'Stock';
    }

    public static function getNavigationLabel(): string
    {
        return 'Stock';
    }

    public static function getNavigationIcon(): ?string
    {
        return 'heroicon-o-cube';
    }

    public function getBreadcrumb(): string
    {
        return 'Stock';
    }

    /**
     * Get variants with their current stock and status.
     */
    public function getVariantsProperty(): \Illuminate\Support\Collection
    {
        return $this->getRecord()->variants()->get()->map(function (ProductVariant $variant) {
            $status = StockService::getStatus($variant);
            return (object) [
                'id' => $variant->id,
                'sku' => $variant->sku,
                'stock' => $variant->stock,
                'status' => $status,
                'status_label' => match ($status) {
                    'in_stock' => 'En stock',
                    'low_stock' => 'Stock baix',
                    'out_of_stock' => 'Sense stock',
                },
                'status_color' => match ($status) {
                    'in_stock' => 'success',
                    'low_stock' => 'warning',
                    'out_of_stock' => 'danger',
                },
            ];
        });
    }

    /**
     * Get movement history for all variants of this product.
     */
    public function getMovementsProperty(): \Illuminate\Support\Collection
    {
        $variantIds = $this->getRecord()->variants()->pluck('id');

        return StockMovement::query()
            ->whereIn('product_variant_id', $variantIds)
            ->with(['variant', 'user'])
            ->orderByDesc('created_at')
            ->limit(50)
            ->get()
            ->map(function (StockMovement $movement) {
                return (object) [
                    'created_at' => $movement->created_at->format('d/m/Y H:i'),
                    'variant_sku' => $movement->variant->sku ?? '-',
                    'quantity' => $movement->quantity,
                    'quantity_label' => $movement->quantity > 0 ? "+{$movement->quantity}" : (string) $movement->quantity,
                    'quantity_color' => $movement->quantity > 0 ? 'success' : ($movement->quantity < 0 ? 'danger' : 'gray'),
                    'type' => $movement->type,
                    'type_label' => match ($movement->type) {
                        'sale' => 'Venda',
                        'cancellation' => 'Cancel·lació',
                        'return' => 'Devolució',
                        'adjustment' => 'Ajust',
                        'reception' => 'Recepció',
                        'initial' => 'Inicial',
                        default => $movement->type,
                    },
                    'type_color' => match ($movement->type) {
                        'sale' => 'danger',
                        'cancellation' => 'warning',
                        'return' => 'info',
                        'adjustment' => 'gray',
                        'reception' => 'success',
                        'initial' => 'primary',
                        default => 'gray',
                    },
                    'reference' => $movement->reference ?? '-',
                    'user_name' => $movement->user->name ?? 'Sistema',
                ];
            });
    }

    /**
     * Open the stock adjustment modal.
     */
    public function adjustStock(int $variantId): void
    {
        $variant = $this->getRecord()->variants()->findOrFail($variantId);

        $this->selectedVariantId = $variant->id;

        $this->dispatch('open-modal', id: 'adjust-stock');

        $this->adjustForm->fill([
            'variant_sku' => $variant->sku,
            'current_stock' => $variant->stock,
            'quantity' => null,
            'type' => 'adjustment',
            'notes' => null,
        ]);
    }

    protected function getForms(): array
    {
        return [
            'adjustForm',
        ];
    }

    public function adjustForm(Form $adjustForm): Form
    {
        return $adjustForm
            ->schema([
                TextInput::make('variant_sku')
                    ->label('Variant (SKU)')
                    ->disabled()
                    ->dehydrated(false),
                TextInput::make('current_stock')
                    ->label('Stock actual')
                    ->disabled()
                    ->dehydrated(false),
                TextInput::make('quantity')
                    ->label('Quantitat')
                    ->helperText('Positiu per afegir, negatiu per treure')
                    ->numeric()
                    ->required()
                    ->integer()
                    ->live()
                    ->afterStateUpdated(fn () => null),
                Select::make('type')
                    ->label('Tipus')
                    ->options([
                        'adjustment' => 'Ajust',
                        'reception' => 'Recepció',
                    ])
                    ->default('adjustment')
                    ->required(),
                Textarea::make('notes')
                    ->label('Notes')
                    ->rows(2)
                    ->placeholder('Motiu de l\'ajust (opcional)'),
            ])
            ->statePath('adjustData');
    }

    /**
     * Submit the stock adjustment.
     */
    public function submitAdjustment(): void
    {
        $data = $this->adjustForm->getState();

        $variant = $this->getRecord()->variants()->findOrFail($this->selectedVariantId);

        $service = app(StockService::class);

        try {
            if ($data['type'] === 'reception') {
                $service->receive($variant, (int) $data['quantity'], $data['notes'] ?? null, auth()->id());
            } else {
                $service->adjust($variant, (int) $data['quantity'], $data['notes'] ?? null, auth()->id());
            }

            Notification::make()
                ->title('Stock actualitzat correctament')
                ->success()
                ->send();

            $this->dispatch('close-modal', id: 'adjust-stock');
        } catch (\InvalidArgumentException $e) {
            Notification::make()
                ->title('Error')
                ->body($e->getMessage())
                ->danger()
                ->send();
        }
    }
}
