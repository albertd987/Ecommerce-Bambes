<?php
// backend/app/Console/Commands/MigrateProductColors.php
namespace App\Console\Commands;

use App\Models\Product;
use App\Models\ProductColor;
use App\Services\ProductColorManager;
use Illuminate\Console\Command;
use Lunar\Models\ProductOption;

class MigrateProductColors extends Command
{
    protected $signature   = 'bambes:migrate-colors {--dry-run : Show what would be created without saving}';
    protected $description = 'Create product_colors records from existing Lunar variants (run once after deploying color management)';

    public function handle(ProductColorManager $manager): int
    {
        $isDryRun = $this->option('dry-run');

        $colorOption = ProductOption::where('handle', 'color')
                           ->orWhere('name', 'Color')
                           ->first();
        $sizeOption  = ProductOption::where('handle', 'talla')
                           ->orWhere('name', 'Talla')
                           ->first();

        if (!$colorOption) {
            $this->error('Color product option not found. Run database seeders first.');
            return self::FAILURE;
        }

        $products = Product::with(['variants.values'])->get();
        $created  = 0;
        $skipped  = 0;

        foreach ($products as $product) {
            // Skip products that already have product_colors records
            if (ProductColor::where('product_id', $product->id)->exists()) {
                $this->line("  SKIP  {$product->id}: {$product->translateAttribute('name')} (already has colors)");
                $skipped++;
                continue;
            }

            // Group variants by color
            $colorGroups = [];
            foreach ($product->variants as $variant) {
                $colorVal = $variant->values->firstWhere('product_option_id', $colorOption->id);
                $sizeVal  = $variant->values->firstWhere('product_option_id', $sizeOption?->id);

                $colorName = $colorVal ? $this->getEnText($colorVal->name) : 'DEFAULT';
                $sizeName  = $sizeVal  ? $this->getEnText($sizeVal->name)  : null;

                if ($sizeName) {
                    $colorGroups[$colorName][] = $sizeName;
                }
            }

            if (empty($colorGroups)) {
                $this->line("  SKIP  {$product->id}: {$product->translateAttribute('name')} (no color/size variants)");
                $skipped++;
                continue;
            }

            $sortOrder = 0;
            foreach ($colorGroups as $colorName => $sizes) {
                $sizes = array_unique($sizes);
                sort($sizes, SORT_NATURAL);

                $productName = $product->translateAttribute('name');
                $this->line("  CREATE {$product->id}: {$productName} → {$colorName} [" . implode(', ', $sizes) . "]");

                if (!$isDryRun) {
                    // Only create the ProductColor record — variants already exist
                    ProductColor::firstOrCreate(
                        ['product_id' => $product->id, 'name' => strtoupper($colorName)],
                        [
                            'sizes'      => array_values($sizes),
                            'sort_order' => $sortOrder,
                        ]
                    );
                }
                $sortOrder++;
                $created++;
            }
        }

        $this->newLine();
        $this->info("Done. Created: {$created}, Skipped: {$skipped}" . ($isDryRun ? ' (dry run — nothing saved)' : ''));

        return self::SUCCESS;
    }

    private function getEnText(mixed $name): string
    {
        if ($name instanceof \ArrayObject) {
            $arr = $name->getArrayCopy();
            return strtoupper($arr['en'] ?? reset($arr) ?? '');
        }
        if (is_array($name)) return strtoupper($name['en'] ?? reset($name) ?? '');
        if (is_string($name)) {
            $decoded = json_decode($name, true);
            if (is_array($decoded)) return strtoupper($decoded['en'] ?? reset($decoded) ?? '');
        }
        return strtoupper((string) $name);
    }
}
