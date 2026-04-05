<?php
namespace App\Filament\Lunar\Extensions;

use App\Filament\Lunar\Pages\ManageProductColors;
use Filament\Tables;
use Filament\Tables\Table;
use Lunar\Admin\Support\Extending\BaseExtension;

class ProductResourceColorsExtension extends BaseExtension
{
    public function extendPages(array $pages): array
    {
        return array_merge($pages, [
            'colors' => ManageProductColors::route('/{record}/colors'),
        ]);
    }

    public function extendSubNavigation(array $pages): array
    {
        return array_merge($pages, [
            ManageProductColors::class,
        ]);
    }

    public static function extendTable(Table $table): Table
    {
        $columns = collect($table->getColumns())->map(function ($column) {
            if ($column->getName() === 'thumbnail') {
                return Tables\Columns\ImageColumn::make('thumbnail')
                    ->label('')
                    ->square()
                    ->state(fn ($record) => $record->thumbnailMedia?->getUrl())
                    ->defaultImageUrl('https://placehold.co/60x60/e5e7eb/6b7280?text=?');
            }
            return $column;
        })->values()->toArray();

        return $table
            ->columns($columns)
            ->modifyQueryUsing(fn ($query) => $query->with('thumbnailMedia'));
    }
}
