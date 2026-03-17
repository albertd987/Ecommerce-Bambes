<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Lunar\Models\Product;

/**
 * Seeder per associar imatges de Cloudinary als 10 productes de demostracio.
 *
 * Usat exclusivament en entorn de desenvolupament i demostracio.
 *
 * Conté un mapa estatic de slug de producte a una llista de 5 public_ids
 * de Cloudinary per producte (50 imatges en total). Per cada producte,
 * descarrega les imatges des de l'URL publica de Cloudinary
 * (res.cloudinary.com/dqkdtkjur/), les afegeix a la col·leccio 'images'
 * de Spatie Media Library, desa el public_id com a custom property
 * 'cloudinary_public_id' i estableix la primera imatge com a thumbnail
 * (actualitzant thumbnail_id al producte).
 *
 * Us: php artisan db:seed --class=AssociateCloudinaryImagesToProductsSeeder
 *
 * @package Database\Seeders
 */
class AssociateCloudinaryImagesToProductsSeeder extends Seeder
{
    /**
     * Itera sobre el mapa de productes i descarrega les imatges de Cloudinary.
     *
     * Per cada entrada del mapa:
     * 1. Cerca el producte per slug a la BD.
     * 2. Per cada public_id, construeix la URL publica i descarrega la imatge.
     * 3. Afegeix la imatge a la col·leccio 'images' via addMediaFromUrl().
     * 4. Desa el public_id com a custom property 'cloudinary_public_id'.
     * 5. Si es la primera imatge (index 0), estableix thumbnail_id al producte.
     *
     * Els errors individuals (imatge no trobada, xarxa, etc.) es capturen
     * i es mostren per consola sense interrompre la resta del proces.
     *
     * @return void
     */
    public function run(): void
    {
        // Mapa: slug del producte => public_ids de Cloudinary
        $productImageMap = [
            'nike-air-zoom-pegasus-41' => [
                'nike41_1_tuymrf',
                'nike41_2_egsfxk',
                'nike41_3_esgco1',
                'nike41_4_rujhvj',
                'nike41_5_f3napx',
            ],
            'asics-gel-kayano-31' => [
                'asicsgelkayano_1_aus1xq',
                'asicsgelkayano_2_vnsf1u',
                'asicsgelkayano_3_idwbcu',
                'asicsgelkayano_4_yn6yg9',
                'asicsgelkayano_5_xfizyo',
            ],
            'hoka-clifton-9' => [
                'hokaclifton_1_xm74vz',
                'hokaclifton_2_s3emtf',
                'hokaclifton_3_gtdbhv',
                'hokaclifton_4_elbu2f',
                'hokaclifton_5_h7gvlb',
            ],
            'adidas-ultraboost-light' => [
                'adidasultraboost_1_brbnkt',
                'adidasultraboost_2_dalxlu',
                'adidasultraboost_3_ykp6ol',
                'adidasultraboost_4_ajpc6u',
                'adidasultraboost_5_syqvmg',
            ],
            'salomon-speedcross-6' => [
                'salomonspeedcross_1_bkhkvj',
                'salomonspeedcross_2_c76yef',
                'salomonspeedcross_3_pwoi6k',
                'salomonspeedcross_4_mrkggo',
                'salomonspeedcross_5_m6wctj',
            ],
            'saucony-peregrine-14' => [
                'sauconyperegrine_1_bcemfn',
                'sauconyperegrine_2_iufmht',
                'sauconyperegrine_3_o32bkd',
                'sauconyperegrine_4_q6z63p',
                'sauconyperegrine_5_gihqgx',
            ],
            'la-sportiva-bushido-ii' => [
                'lasportivabushido_1_ip1iye',
                'lasportivabushido_2_oimypy',
                'lasportivabushido_3_vngit2',
                'lasportivabushido_4_qr8foi',
                'lasportivabushido_5_t6ec2m',
            ],
            'brooks-ghost-16' => [
                'brooksghost_1_qh4wxj',
                'brooksghost_2_iowgyt',
                'brooksghost_3_hkgxqa',
                'brooksghost_4_ji7ad7',
                'brooksghost_5_facb2i',
            ],
            'new-balance-fresh-foam-x-1080v13' => [
                'newbalancefreshfoam_1_akp6th',
                'newbalancefreshfoam_2_imfp8o',
                'newbalancefreshfoam_3_uz0uwz',
                'newbalancefreshfoam_4_jqex84',
                'newbalancefreshfoam_5_wib9u5',
            ],
            'mizuno-wave-rider-27' => [
                'mizunowaverider_1_iy7vpj',
                'mizunowaverider_2_oo9bmn',
                'mizunowaverider_3_bdycrd',
                'mizunowaverider_4_mesuyf',
                'mizunowaverider_5_vvkbd6',
            ],
        ];

        $this->command->info("Associant imatges de Cloudinary a productes...\n");

        foreach ($productImageMap as $productSlug => $cloudinaryIds) {
            $product = Product::where('slug', $productSlug)->first();

            if (!$product) {
                $this->command->warn("Producte '{$productSlug}' no trobat");
                continue;
            }

            foreach ($cloudinaryIds as $index => $cloudinaryId) {
                $cloudinaryUrl = "https://res.cloudinary.com/dqkdtkjur/image/upload/{$cloudinaryId}.jpg";

                try {
                    $media = $product->addMediaFromUrl($cloudinaryUrl)
                        ->toMediaCollection('images');

                    $media->setCustomProperty('cloudinary_public_id', $cloudinaryId);
                    $media->save();

                    if ($index === 0) {
                        $product->update(['thumbnail_id' => $media->id]);
                    }

                    $this->command->info("{$product->translateAttribute('name')}: {$cloudinaryId}");

                } catch (\Exception $e) {
                    $this->command->error("Error amb {$cloudinaryId}: " . $e->getMessage());
                }
            }
        }

        $this->command->info("\nAssociació completada!");
    }
}