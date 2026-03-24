<?php
namespace App\Filament\Lunar\Pages;

use App\Models\ProductColor;
use App\Services\ProductColorManager;
use Filament\Actions\Action;
use Filament\Forms\Components\CheckboxList;
use Filament\Forms\Components\FileUpload;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Concerns\InteractsWithForms;
use Filament\Forms\Contracts\HasForms;
use Filament\Notifications\Notification;
use Filament\Resources\Pages\Concerns\InteractsWithRecord;
use Filament\Resources\Pages\Page;
use Illuminate\Contracts\Support\Htmlable;
use Lunar\Admin\Filament\Resources\ProductResource;

class ManageProductColors extends Page implements HasForms
{
    use InteractsWithForms;
    use InteractsWithRecord;

    protected static string $resource = ProductResource::class;
    protected static string $view     = 'filament.pages.manage-product-colors';

    public function mount(int|string $record): void
    {
        $this->record = $this->resolveRecord($record);
    }

    public function getTitle(): string|Htmlable
    {
        return 'Colors i Imatges';
    }

    public static function getNavigationLabel(): string
    {
        return 'Colors i Imatges';
    }

    public static function getNavigationIcon(): ?string
    {
        return 'heroicon-o-swatch';
    }

    public function getBreadcrumb(): string
    {
        return 'Colors i Imatges';
    }

    /** Computed property — refreshes automatically after Livewire actions */
    public function getColorsProperty(): \Illuminate\Support\Collection
    {
        return app(ProductColorManager::class)
            ->getColors($this->getRecord())
            ->map(function (ProductColor $color) {
                return (object) [
                    'id'     => $color->id,
                    'name'   => $color->name,
                    'sizes'  => $color->sizes,
                    'images' => $color->getMedia('images')->map(fn($m) => (object) [
                        'id'  => $m->id,
                        'url' => $m->getUrl(),
                    ]),
                ];
            });
    }

    public function getAvailableSizesProperty(): array
    {
        return config('bambes.sizes', []);
    }

    // -------------------------------------------------------------------------
    // Header Actions — ALL actions (visible and hidden modal triggers) go here.
    // In Filament v3, getActions() is deprecated; use getHeaderActions() only.
    // Hidden actions are not rendered as buttons but can be triggered via
    // $this->mountAction('name', arguments: [...]) from Livewire methods.
    // -------------------------------------------------------------------------

    protected function getHeaderActions(): array
    {
        return [
            // ── Visible button ───────────────────────────────────────────────
            Action::make('addColor')
                ->label('Afegir color nou')
                ->icon('heroicon-o-plus')
                ->form($this->colorForm())
                ->action(function (array $data): void {
                    app(ProductColorManager::class)->syncColor(
                        $this->getRecord(),
                        $data['name'],
                        $data['sizes'] ?? []
                    );
                    Notification::make()->title('Color afegit correctament')->success()->send();
                }),

            // ── Hidden modal: edit color (triggered from Blade via editColor()) ──
            Action::make('editColorModal')
                ->hidden()
                ->modalHeading('Editar color')
                ->form($this->colorForm())
                ->fillForm(fn(array $arguments) => [
                    'name'  => $arguments['name'] ?? '',
                    'sizes' => $arguments['sizes'] ?? [],
                ])
                ->action(function (array $data): void {
                    app(ProductColorManager::class)->syncColor(
                        $this->getRecord(),
                        $data['name'],
                        $data['sizes'] ?? []
                    );
                    Notification::make()->title('Color actualitzat')->success()->send();
                }),

            // ── Hidden modal: add images (triggered from Blade via addImages()) ──
            Action::make('addImagesModal')
                ->hidden()
                ->modalHeading('Afegir imatges')
                ->form([
                    FileUpload::make('images')
                        ->label('Selecciona les imatges')
                        ->multiple()
                        ->image()
                        ->reorderable()
                        ->maxFiles(10)
                        ->maxSize(5120)
                        ->acceptedFileTypes(['image/jpeg', 'image/png', 'image/webp'])
                        ->helperText('Màx. 10 imatges, 5 MB cadascuna.'),
                ])
                ->action(function (array $data, array $arguments): void {
                    $color = ProductColor::where('product_id', $this->getRecord()->id)
                                         ->findOrFail($arguments['colorId']);
                    foreach ($data['images'] ?? [] as $file) {
                        if ($file) {
                            $color->addMedia($file)->toMediaCollection('images');
                        }
                    }
                    Notification::make()->title('Imatges afegides')->success()->send();
                }),
        ];
    }

    // -------------------------------------------------------------------------
    // Per-color Livewire methods (called from Blade with wire:click)
    // -------------------------------------------------------------------------

    public function editColor(int $colorId): void
    {
        $color = ProductColor::findOrFail($colorId);
        $this->mountAction('editColorModal', [
            'colorId' => $colorId,
            'name'    => $color->name,
            'sizes'   => $color->sizes,
        ]);
    }

    public function addImages(int $colorId): void
    {
        $this->mountAction('addImagesModal', ['colorId' => $colorId]);
    }

    public function deleteImage(int $mediaId): void
    {
        $media = \Spatie\MediaLibrary\MediaCollections\Models\Media::findOrFail($mediaId);
        // Security: ensure this media belongs to a ProductColor of this product
        $color = ProductColor::where('product_id', $this->getRecord()->id)->find($media->model_id);
        if ($color && $media->model_type === ProductColor::class) {
            $media->delete();
            Notification::make()->title('Imatge eliminada')->success()->send();
        }
    }

    public function deleteColor(int $colorId): void
    {
        $color = ProductColor::where('product_id', $this->getRecord()->id)->findOrFail($colorId);
        app(ProductColorManager::class)->removeColor($this->getRecord(), $color->name);
        Notification::make()->title('Color eliminat')->success()->send();
    }

    // -------------------------------------------------------------------------
    // Shared form schema
    // -------------------------------------------------------------------------

    private function colorForm(): array
    {
        return [
            TextInput::make('name')
                ->label('Nom del color')
                ->placeholder('Ex: BLANC, NEGRE, BLAU')
                ->required()
                ->maxLength(100)
                ->helperText('Escriu en majúscules. Ex: BLANC, NEGRE, BLAU FOSC'),

            CheckboxList::make('sizes')
                ->label('Tallas disponibles')
                ->options(
                    collect(config('bambes.sizes', []))->mapWithKeys(fn($s) => [$s => $s])->toArray()
                )
                ->columns(6)
                ->required()
                ->minItems(1),
        ];
    }
}
