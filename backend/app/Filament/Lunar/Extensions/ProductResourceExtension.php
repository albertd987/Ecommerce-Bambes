<?php

namespace App\Filament\Lunar\Extensions;

use App\Services\SimpleProductCreator;
use Filament\Actions\CreateAction;
use Filament\Forms\Components\CheckboxList;
use Filament\Forms\Components\FileUpload;
use Filament\Forms\Components\Grid;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\Textarea;
use Filament\Forms\Components\TextInput;
use Illuminate\Database\Eloquent\Model;
use Lunar\Admin\Filament\Resources\ProductResource;
use Lunar\Admin\Support\Extending\BaseExtension;
use Lunar\Models\Brand;
use Lunar\Models\Collection;

/**
 * Extensió de la pàgina ListProducts de Lunar.
 *
 * Substitueix el popup "New Product" per un formulari simplificat:
 * - Sense Product Type (sempre usa "Bambes")
 * - Sense SKU manual (generat automàticament)
 * - Publica el producte directament (status='published')
 */
class ProductResourceExtension extends BaseExtension
{
    /**
     * Substitueix l'acció "New Product" per una versió simplificada.
     */
    public function headerActions(array $actions): array
    {
        $brandOptions = Brand::orderBy('name')
            ->get()
            ->mapWithKeys(fn($b) => [$b->id => $b->name])
            ->toArray();

        $collectionOptions = Collection::all()
            ->mapWithKeys(function ($c) {
                $name = $c->translateAttribute('name');
                return [$c->id => $name];
            })
            ->filter()
            ->toArray();

        $createAction = CreateAction::make()
            ->createAnother(false)
            ->form([
                Grid::make(2)->schema([
                    TextInput::make('name')
                        ->label('Nom del producte')
                        ->placeholder('Ex: Nike Air Zoom Pegasus 41')
                        ->required()
                        ->maxLength(255),

                    TextInput::make('price')
                        ->label('Preu (€)')
                        ->placeholder('139.99')
                        ->required()
                        ->numeric()
                        ->minValue(0.01)
                        ->prefix('€'),
                ]),

                Textarea::make('description')
                    ->label('Descripció (opcional)')
                    ->placeholder('Descriu breument el producte...')
                    ->rows(2),

                Grid::make(2)->schema([
                    Select::make('brand_id')
                        ->label('Marca')
                        ->options($brandOptions)
                        ->searchable()
                        ->placeholder('Sense marca')
                        ->createOptionForm([
                            TextInput::make('name')
                                ->label('Nom de la nova marca')
                                ->required()
                                ->maxLength(100),
                        ])
                        ->createOptionUsing(function (array $data) {
                            return Brand::create(['name' => trim($data['name'])])->id;
                        }),

                    TextInput::make('stock')
                        ->label('Stock inicial')
                        ->numeric()
                        ->default(0)
                        ->minValue(0)
                        ->suffix('unitats'),
                ]),

                CheckboxList::make('collection_ids')
                    ->label('Categories')
                    ->options($collectionOptions)
                    ->columns(2),

                FileUpload::make('images')
                    ->label('Imatges (opcional)')
                    ->multiple()
                    ->image()
                    ->reorderable()
                    ->maxFiles(10)
                    ->maxSize(5120)
                    ->acceptedFileTypes(['image/jpeg', 'image/png', 'image/webp'])
                    ->helperText('La primera imatge serà la miniatura. Màx. 10 imatges, 5 MB cadascuna.')
                    ->directory('tmp-products'),
            ])
            ->using(function (array $data, string $model): Model {
                return app(SimpleProductCreator::class)->create([
                    'name'           => $data['name'],
                    'description'    => $data['description'] ?? null,
                    'brand_id'       => $data['brand_id'] ?? null,
                    'price'          => (float) $data['price'],
                    'collection_ids' => $data['collection_ids'] ?? [],
                    'images'         => $data['images'] ?? [],
                    'stock'          => (int) ($data['stock'] ?? 0),
                    'has_variants'   => false,
                ]);
            })
            ->successRedirectUrl(fn(Model $record): string => ProductResource::getUrl('edit', [
                'record' => $record,
            ]));

        return [$createAction];
    }
}
