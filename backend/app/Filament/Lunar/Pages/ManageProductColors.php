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
use Filament\Forms\Form;
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

    /** ID of the color being edited in the edit modal */
    public ?int $editingColorId = null;
    public array $editColorData = [];

    /** ID of the color receiving new images in the add-images modal */
    public ?int $uploadingColorId = null;
    public array $uploadData = [];

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
    // Header actions — only the "add new color" button
    // -------------------------------------------------------------------------

    protected function getHeaderActions(): array
    {
        return [
            Action::make('addColor')
                ->label('Afegir color nou')
                ->icon('heroicon-o-plus')
                ->form([
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
                ])
                ->action(function (array $data): void {
                    app(ProductColorManager::class)->syncColor(
                        $this->getRecord(),
                        $data['name'],
                        $data['sizes'] ?? []
                    );
                    Notification::make()->title('Color afegit correctament')->success()->send();
                }),
        ];
    }

    // -------------------------------------------------------------------------
    // Named forms rendered directly in the blade modals
    // -------------------------------------------------------------------------

    protected function getForms(): array
    {
        return ['editColorForm', 'addImagesForm'];
    }

    public function editColorForm(Form $editColorForm): Form
    {
        return $editColorForm
            ->schema([
                TextInput::make('name')
                    ->label('Nom del color')
                    ->disabled()
                    ->dehydrated(false),

                CheckboxList::make('sizes')
                    ->label('Tallas disponibles')
                    ->options(
                        collect(config('bambes.sizes', []))->mapWithKeys(fn($s) => [$s => $s])->toArray()
                    )
                    ->columns(6)
                    ->required()
                    ->minItems(1),
            ])
            ->statePath('editColorData');
    }

    public function addImagesForm(Form $addImagesForm): Form
    {
        return $addImagesForm
            ->schema([
                FileUpload::make('images')
                    ->label('Selecciona les imatges')
                    ->multiple()
                    ->image()
                    ->reorderable()
                    ->maxFiles(10)
                    ->maxSize(20480)
                    ->acceptedFileTypes(['image/jpeg', 'image/png', 'image/webp'])
                    ->helperText('Màx. 10 imatges, 5 MB cadascuna.'),
            ])
            ->statePath('uploadData');
    }

    // -------------------------------------------------------------------------
    // Modal open / save methods (called via wire:click from blade)
    // -------------------------------------------------------------------------

    public function openEditColor(int $colorId): void
    {
        $color = ProductColor::where('product_id', $this->getRecord()->id)
                              ->findOrFail($colorId);

        $this->editingColorId = $color->id;
        $this->editColorForm->fill([
            'name'  => $color->name,
            'sizes' => $color->sizes ?? [],
        ]);
        $this->dispatch('open-modal', id: 'edit-color');
    }

    public function saveEditColor(): void
    {
        $data  = $this->editColorForm->getState();
        $color = ProductColor::where('product_id', $this->getRecord()->id)
                              ->findOrFail($this->editingColorId);

        app(ProductColorManager::class)->syncColor(
            $this->getRecord(),
            $color->name,
            $data['sizes'] ?? []
        );

        Notification::make()->title('Color actualitzat')->success()->send();
        $this->dispatch('close-modal', id: 'edit-color');
    }

    public function openAddImages(int $colorId): void
    {
        ProductColor::where('product_id', $this->getRecord()->id)
                    ->findOrFail($colorId);

        $this->uploadingColorId = $colorId;
        $this->addImagesForm->fill(['images' => []]);
        $this->dispatch('open-modal', id: 'add-images');
    }

    public function saveAddImages(): void
    {
        $data  = $this->addImagesForm->getState();
        $color = ProductColor::where('product_id', $this->getRecord()->id)
                              ->findOrFail($this->uploadingColorId);

        foreach ($data['images'] ?? [] as $file) {
            if ($file) {
                $color->addMediaFromDisk($file, 'public')->toMediaCollection('images');
            }
        }

        Notification::make()->title('Imatges afegides')->success()->send();
        $this->dispatch('close-modal', id: 'add-images');
    }

    // -------------------------------------------------------------------------
    // Per-image / per-color delete (called via wire:click from blade)
    // -------------------------------------------------------------------------

    public function deleteImage(int $mediaId): void
    {
        $media = \Spatie\MediaLibrary\MediaCollections\Models\Media::findOrFail($mediaId);
        $color = ProductColor::where('product_id', $this->getRecord()->id)->find($media->model_id);
        if ($color && $media->model_type === ProductColor::class) {
            $media->delete();
            Notification::make()->title('Imatge eliminada')->success()->send();
        } else {
            Notification::make()->title('No s\'ha pogut eliminar la imatge')->danger()->send();
        }
    }

    public function deleteColor(int $colorId): void
    {
        $color = ProductColor::where('product_id', $this->getRecord()->id)->findOrFail($colorId);
        app(ProductColorManager::class)->removeColor($this->getRecord(), $color->name);
        Notification::make()->title('Color eliminat')->success()->send();
    }
}
