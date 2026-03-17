<?php
// app/Console/Commands/ImportProductImages.php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Lunar\Models\Product;

/**
 * Comanda Artisan per importar imatges locals i associar-les a productes Lunar.
 *
 * Llegeix tots els fitxers d'imatge (JPG, JPEG, PNG, WebP) d'un directori
 * i els associa als productes comparant els primers 4 caracters del nom
 * del fitxer (en minuscules, sense espais) amb els primers 4 caracters
 * del nom del producte. Les imatges s'afegeixen a la col·leccio 'images'
 * de Spatie Media Library, preservant l'original.
 *
 * Opcions disponibles:
 * - --dry-run: mostra que s'importaria sense fer-ho realment.
 * - --force: reimporta imatges encara que el producte ja en tingui.
 * - --clear: elimina les imatges existents abans d'importar.
 *
 * Us: php artisan products:import-images {path} [--dry-run] [--force] [--clear]
 *
 * @package App\Console\Commands
 */
class ImportProductImages extends Command
{
    /** @var string Signatura de la comanda amb arguments i opcions. */
    protected $signature = 'products:import-images
                            {path : Path to the directory containing product images}
                            {--dry-run : Show what would be imported without actually doing it}
                            {--force : Force re-import even if images already exist}
                            {--clear : Clear existing images before importing}';

    /** @var string Descripció de la comanda Artisan. */
    protected $description = 'Import product images matching products by first 4 characters';

    /**
     * Executa la importacio d'imatges des del directori especificat.
     *
     * 1. Valida que el directori existeixi i contingui fitxers d'imatge.
     * 2. Agrupa els fitxers per prefix de 4 caracters.
     * 3. Per cada producte de la BD, cerca imatges amb prefix coincident.
     * 4. Importa les imatges a la col·leccio 'images' (preservant l'original).
     * 5. Mostra un resum final amb productes importats, omesos i errors.
     *
     * @return int 0 si l'execucio es correcta, 1 si el directori no existeix o no te imatges.
     */
    public function handle()
    {
        $path = $this->argument('path');
        
        // Validar que el directori existeixi
        if (!is_dir($path)) {
            $this->error("Directori no trobat: {$path}");
            return 1;
        }

        // Obtenir tots els fitxers d'imatge
        $files = glob($path . '/*.{jpg,jpeg,png,webp}', GLOB_BRACE);

        if (empty($files)) {
            $this->error("No s'han trobat fitxers d'imatge a: {$path}");
            return 1;
        }

        $this->info("Trobats " . count($files) . " fitxers d'imatge");
        $this->newLine();

        // Obtenir tots els productes
        $products = Product::all();

        if ($products->isEmpty()) {
            $this->error("No s'han trobat productes a la base de dades");
            return 1;
        }

        $this->info("Trobats " . $products->count() . " productes a la base de dades");
        $this->newLine();

        // Agrupar fitxers per les primeres 4 lletres
        $filesByPrefix = $this->groupFilesByPrefix($files);
        
        $imported = 0;
        $skipped = 0;
        $totalImages = 0;
        $alreadyExists = 0;

        // Processar cada producte
        foreach ($products as $product) {
            $productName = $product->translateAttribute('name');

            if (!$productName) {
                $this->warn("Producte ID {$product->id} sense nom, s'omet");
                continue;
            }

            // Obtenir les primeres 4 lletres del nom del producte
            $prefix = $this->getPrefix($productName);

            if (strlen($prefix) < 4) {
                $this->warn("Producte '{$productName}' prefix massa curt, s'omet");
                continue;
            }

            // Cercar imatges que coincideixin amb aquest prefix
            $matchingFiles = $filesByPrefix[$prefix] ?? [];

            if (empty($matchingFiles)) {
                $this->line("No s'han trobat imatges per a: {$productName} (prefix: {$prefix})");
                continue;
            }

            // Ordenar fitxers alfabèticament
            sort($matchingFiles);

            // NOU: Verificar si el producte ja té imatges
            $existingImagesCount = $product->getMedia('images')->count();

            if ($existingImagesCount > 0 && !$this->option('force')) {
                $this->line("Producte: {$productName} ja té {$existingImagesCount} imatges (usa --force per reimportar)");
                $alreadyExists++;
                continue;
            }

            $this->info("Producte: {$productName} (prefix: {$prefix})");
            $this->line("   Found " . count($matchingFiles) . " matching images");

            // NOU: Si s'especifica --clear, eliminar imatges existents
            if ($this->option('clear') && $existingImagesCount > 0) {
                $this->line("   Eliminant {$existingImagesCount} imatges existents...");
                if (!$this->option('dry-run')) {
                    $product->clearMediaCollection('images');
                }
            }

            if ($this->option('dry-run')) {
                foreach ($matchingFiles as $file) {
                    $this->line("   Would import: " . basename($file));
                }
                $imported++;
                $totalImages += count($matchingFiles);
                $this->newLine();
                continue;
            }

            // Importar les imatges
            try {
                foreach ($matchingFiles as $file) {
                    $product->addMedia($file)
                        ->preservingOriginal()
                        ->toMediaCollection('images');

                    $this->line("   Importat: " . basename($file));
                    $totalImages++;
                }

                $imported++;
                $this->newLine();

            } catch (\Exception $e) {
                $this->error("   Error important imatges per a {$productName}: " . $e->getMessage());
                $skipped++;
                $this->newLine();
            }
        }

        // Resum final
        $this->newLine();
        $this->info("Resum d'importació:");
        $this->table(
            ['Metric', 'Count'],
            [
                ['Products with images imported', $imported],
                ['Products already with images', $alreadyExists],
                ['Products skipped', $skipped],
                ['Total images imported', $totalImages],
                ['Total products processed', $products->count()]
            ]
        );

        return 0;
    }

    /**
     * Obté el prefix de 4 caràcters d'un text.
     *
     * Neteja espais, converteix a minúscules i retorna els primers 4 caràcters.
     *
     * @param  string  $text  El text del qual extreure el prefix.
     * @return string El prefix de 4 caràcters (o menys si el text és curt).
     */
    private function getPrefix(string $text): string
    {
        $cleaned = strtolower(trim(str_replace(' ', '', $text)));
        return substr($cleaned, 0, 4);
    }

    /**
     * Agrupa una llista de fitxers per les primeres 4 lletres del nom.
     *
     * @param  array  $files  Llista de camins absoluts de fitxers d'imatge.
     * @return array<string, array<string>> Mapa prefix => llista de camins.
     */
    private function groupFilesByPrefix(array $files): array
    {
        $grouped = [];

        foreach ($files as $file) {
            $filename = pathinfo($file, PATHINFO_FILENAME);
            $prefix = $this->getPrefix($filename);
            
            if (strlen($prefix) >= 4) {
                if (!isset($grouped[$prefix])) {
                    $grouped[$prefix] = [];
                }
                $grouped[$prefix][] = $file;
            }
        }

        return $grouped;
    }
}