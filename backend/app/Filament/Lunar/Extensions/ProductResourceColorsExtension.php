<?php
namespace App\Filament\Lunar\Extensions;

use App\Filament\Lunar\Pages\ManageProductColors;
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
}
