<?php

namespace App\Filament\Lunar\Extensions;

use Filament\Actions\Action;
use Filament\Forms\Components\TextInput;
use Lunar\Admin\Support\Extending\BaseExtension;
use Lunar\Models\Currency;
use Lunar\Models\Price;

class ProductResourcePriceExtension extends BaseExtension
{
    public function headerActions(array $actions): array
    {
        $priceAction = Action::make('edit_price')
            ->label('Editar preu')
            ->icon('heroicon-o-currency-euro')
            ->fillForm(function () {
                $product = $this->caller->getRecord();
                $firstVariant = $product->variants()->with('prices')->first();
                $priceCents = $firstVariant?->prices->first()?->price?->value ?? 0;

                return ['price' => number_format($priceCents / 100, 2, '.', '')];
            })
            ->form([
                TextInput::make('price')
                    ->label('Preu (EUR)')
                    ->numeric()
                    ->minValue(0)
                    ->step(0.01)
                    ->suffix('€')
                    ->required(),
            ])
            ->action(function (array $data) {
                $product = $this->caller->getRecord();
                $priceCents = (int) round((float) $data['price'] * 100);
                $currency = Currency::where('default', true)->first();

                $product->variants()->with('prices')->get()->each(function ($variant) use ($priceCents, $currency) {
                    $existingPrice = $variant->prices->first();

                    if ($existingPrice) {
                        $existingPrice->update(['price' => $priceCents]);
                    } else {
                        Price::create([
                            'priceable_type' => 'product_variant',
                            'priceable_id'   => $variant->id,
                            'currency_id'    => $currency->id,
                            'price'          => $priceCents,
                            'min_quantity'   => 1,
                        ]);
                    }
                });
            })
            ->successNotificationTitle('Preu actualitzat correctament')
            ->modalHeading('Editar preu del producte')
            ->modalDescription('El nou preu s\'aplicarà a totes les variants del producte.')
            ->modalSubmitActionLabel('Guardar preu');

        return array_merge([$priceAction], $actions);
    }
}
