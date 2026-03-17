<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Lunar\Models\Currency;
use Lunar\Models\ProductVariant;

/**
 * Comanda Artisan per assignar preus base a variants de producte sense preu.
 *
 * Cerca totes les ProductVariant que no tenen cap registre a basePrices
 * i crea un preu en EUR (centims) basat en un mapa predefinit per marca.
 * Si la marca no es troba al mapa, assigna el preu per defecte (13999 centims).
 *
 * La moneda EUR es crea o recupera automaticament (firstOrCreate).
 * Mostra una barra de progres durant l'execucio.
 *
 * Us: php artisan products:assign-prices
 *
 * @package App\Console\Commands
 */
class AssignProductPrices extends Command
{
    /** @var string Signatura de la comanda Artisan. */
    protected $signature = 'products:assign-prices';

    /** @var string Descripció de la comanda Artisan. */
    protected $description = 'Assign prices to all product variants';

    /**
     * Executa la comanda d'assignacio de preus.
     *
     * 1. Crea o recupera la moneda EUR com a moneda per defecte.
     * 2. Defineix un mapa de preus en centims per cada marca (Nike, ASICS, HOKA, etc.).
     * 3. Cerca variants sense preu assignat (whereDoesntHave('basePrices')).
     * 4. Per cada variant, crea un registre Price amb el preu corresponent a la seva marca.
     *
     * @return int Command::SUCCESS (0) en tots els casos.
     */
    public function handle()
    {
        $this->info('Assignant preus a variants...');

        // 1. Crear/obtenir moneda EUR
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

        $this->info("Moneda EUR: {$currency->id}");

        // 2. Definir preus per marca (en cèntims)
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

        // 3. Obtenir variants sense preu
        $variantsWithoutPrice = ProductVariant::whereDoesntHave('basePrices')
            ->with('product.brand')
            ->get();

        $this->info("Variants sense preu: {$variantsWithoutPrice->count()}");

        if ($variantsWithoutPrice->count() === 0) {
            $this->info('Totes les variants ja tenen preu assignat!');
            return Command::SUCCESS;
        }

        // 4. Assignar preus
        $bar = $this->output->createProgressBar($variantsWithoutPrice->count());
        $bar->start();

        $count = 0;
        foreach ($variantsWithoutPrice as $variant) {
            $brandName = $variant->product->brand?->name ?? 'default';
            $price = $pricesByBrand[$brandName] ?? $pricesByBrand['default'];

            // SENSE el camp 'tier'
            $variant->basePrices()->create([
                'price' => $price,
                'currency_id' => $currency->id,
            ]);

            $count++;
            $bar->advance();
        }

        $bar->finish();
        $this->newLine();
        $this->info("Total de preus assignats: {$count}");

        return Command::SUCCESS;
    }
}