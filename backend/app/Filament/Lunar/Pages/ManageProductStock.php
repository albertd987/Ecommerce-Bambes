<?php

namespace App\Filament\Lunar\Pages;

use App\Models\StockMovement;
use App\Services\StockService;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\Textarea;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Concerns\InteractsWithForms;
use Filament\Forms\Contracts\HasForms;
use Filament\Notifications\Notification;
use Filament\Resources\Pages\Page;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Concerns\InteractsWithTable;
use Filament\Tables\Contracts\HasTable;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Table;
use Illuminate\Contracts\Support\Htmlable;
use Illuminate\Support\HtmlString;
use Lunar\Admin\Filament\Resources\ProductResource;
use Lunar\Models\ProductVariant;

class ManageProductStock extends Page implements HasForms, HasTable
{
    use InteractsWithForms;
    use InteractsWithTable;

    protected static string $resource = ProductResource::class;

    protected static string $view = 'filament.pages.manage-product-stock';

    public $record;

    public function mount(int|string $record): void
    {
        $this->record = static::$resource::resolveRecordRouteBinding($record);
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
     * Get variants with their current stock and status for the top section.
     */
    public function getVariantsProperty(): \Illuminate\Support\Collection
    {
        return $this->record->variants()->get()->map(function (ProductVariant $variant) {
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
                'variant' => $variant,
            ];
        });
    }

    /**
     * Open the stock adjustment modal.
     */
    public function adjustStock(int $variantId): void
    {
        $variant = $this->record->variants()->findOrFail($variantId);

        $this->dispatch('open-modal', id: 'adjust-stock');

        $this->adjustForm->fill([
            'variant_id' => $variant->id,
            'variant_sku' => $variant->sku,
            'current_stock' => $variant->stock,
            'quantity' => null,
            'type' => 'adjustment',
            'notes' => null,
        ]);
    }

    /**
     * Define the adjustment form.
     */
    protected function getForms(): array
    {
        return [
            'adjustForm',
            'table',
        ];
    }

    public function adjustForm(\Filament\Forms\Form $form): \Filament\Forms\Form
    {
        return $form
            ->schema([
                TextInput::make('variant_id')
                    ->hidden(),
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

    public array $adjustData = [];

    /**
     * Submit the stock adjustment.
     */
    public function submitAdjustment(): void
    {
        $data = $this->adjustForm->getState();

        $variant = $this->record->variants()->findOrFail($data['variant_id']);

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

    /**
     * Movement history table.
     */
    public function table(Table $table): Table
    {
        $variantIds = $this->record->variants()->pluck('id');

        return $table
            ->query(
                StockMovement::query()
                    ->whereIn('product_variant_id', $variantIds)
                    ->with(['variant', 'user'])
            )
            ->defaultSort('created_at', 'desc')
            ->columns([
                TextColumn::make('created_at')
                    ->label('Data')
                    ->dateTime('d/m/Y H:i')
                    ->sortable(),
                TextColumn::make('variant.sku')
                    ->label('Variant (SKU)')
                    ->searchable(),
                TextColumn::make('quantity')
                    ->label('Quantitat')
                    ->formatStateUsing(fn (int $state): string => $state > 0 ? "+{$state}" : (string) $state)
                    ->color(fn (int $state): string => $state > 0 ? 'success' : ($state < 0 ? 'danger' : 'gray')),
                TextColumn::make('type')
                    ->label('Tipus')
                    ->badge()
                    ->formatStateUsing(fn (string $state): string => match ($state) {
                        'sale' => 'Venda',
                        'cancellation' => 'Cancel·lació',
                        'return' => 'Devolució',
                        'adjustment' => 'Ajust',
                        'reception' => 'Recepció',
                        'initial' => 'Inicial',
                        default => $state,
                    })
                    ->color(fn (string $state): string => match ($state) {
                        'sale' => 'danger',
                        'cancellation' => 'warning',
                        'return' => 'info',
                        'adjustment' => 'gray',
                        'reception' => 'success',
                        'initial' => 'primary',
                        default => 'gray',
                    }),
                TextColumn::make('reference')
                    ->label('Referència')
                    ->placeholder('-'),
                TextColumn::make('user.name')
                    ->label('Usuari')
                    ->placeholder('Sistema'),
            ])
            ->filters([
                SelectFilter::make('product_variant_id')
                    ->label('Variant')
                    ->options(fn () => $this->record->variants()->pluck('sku', 'id')->toArray()),
                SelectFilter::make('type')
                    ->label('Tipus')
                    ->options([
                        'sale' => 'Venda',
                        'cancellation' => 'Cancel·lació',
                        'return' => 'Devolució',
                        'adjustment' => 'Ajust',
                        'reception' => 'Recepció',
                        'initial' => 'Inicial',
                    ]),
            ])
            ->paginated([10, 25, 50]);
    }

    /**
     * Get the record for sub-navigation context.
     */
    public function getRecord()
    {
        return $this->record;
    }

    public function getRecordTitle(): string|Htmlable
    {
        return $this->record->translateAttribute('name');
    }

    /**
     * Required for sub-navigation to work.
     */
    public static function getResource(): string
    {
        return static::$resource;
    }
}
