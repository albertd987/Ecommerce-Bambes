<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Lunar\Models\Currency;
use Lunar\Models\ProductVariant;

class AssignProductPrices extends Command
{
    protected $signature = 'products:assign-prices';
    protected $description = 'Assign prices to all product variants';

    public function handle()
    {
        $this->info('🚀 Asignando precios a variantes...');

        // 1. Crear/obtener moneda EUR
        $currency = Currency::firstOrCreate(
            ['code' => 'EUR'],
            [
                'name' => 'Euro',
                'exchange_rate' => 1,
                'decimal_places' => 2,
                'enabled' => true,
                'default' => true,
            ]
        );

        $this->info("✅ Moneda EUR: {$currency->id}");

        // 2. Definir precios por marca (en centavos)
        $pricesByBrand = [
            'Nike' => 13999,
            'ASICS' => 16999,
            'HOKA' => 14999,
            'Adidas' => 15999,
            'Salomon' => 12999,
            'Saucony' => 13499,
            'La Sportiva' => 15499,
            'Brooks' => 14499,
            'New Balance' => 14999,
            'Mizuno' => 13999,
            'default' => 13999,
        ];

        // 3. Obtener variantes sin precio
        $variantsWithoutPrice = ProductVariant::whereDoesntHave('basePrices')
            ->with('product.brand')
            ->get();

        $this->info("📦 Variantes sin precio: {$variantsWithoutPrice->count()}");

        if ($variantsWithoutPrice->count() === 0) {
            $this->info('✅ Todas las variantes ya tienen precio asignado!');
            return Command::SUCCESS;
        }

        // 4. Asignar precios
        $bar = $this->output->createProgressBar($variantsWithoutPrice->count());
        $bar->start();

        $count = 0;
        foreach ($variantsWithoutPrice as $variant) {
            $brandName = $variant->product->brand?->name ?? 'default';
            $price = $pricesByBrand[$brandName] ?? $pricesByBrand['default'];

            // SIN el campo 'tier'
            $variant->basePrices()->create([
                'price' => $price,
                'currency_id' => $currency->id,
            ]);

            $count++;
            $bar->advance();
        }

        $bar->finish();
        $this->newLine();
        $this->info("✅ Total de precios asignados: {$count}");

        return Command::SUCCESS;
    }
}