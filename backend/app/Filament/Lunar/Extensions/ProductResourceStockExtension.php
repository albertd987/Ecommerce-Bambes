<?php

namespace App\Filament\Lunar\Extensions;

use App\Filament\Lunar\Pages\ManageProductStock;
use Lunar\Admin\Support\Extending\BaseExtension;

/**
 * Extensió del ProductResource per afegir la pàgina de gestió d'stock.
 *
 * Registra la ruta i el subnavegació per la pàgina ManageProductStock.
 */
class ProductResourceStockExtension extends BaseExtension
{
    public function extendPages(array $pages): array
    {
        return array_merge($pages, [
            'stock' => ManageProductStock::route('/{record}/stock'),
        ]);
    }

    public function extendSubNavigation(array $pages): array
    {
        return array_merge($pages, [
            ManageProductStock::class,
        ]);
    }
}
