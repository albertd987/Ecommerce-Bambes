<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

/**
 * Seeder principal de la base de dades (punt d'entrada).
 *
 * Orquestra l'execucio de tots els seeders del projecte.
 * Actualment nomes crida al LunarBambesDemoSeeder per poblar
 * les dades de demostracio (productes, variants, preus, marques, etc.).
 *
 * Usat exclusivament en entorn de desenvolupament i demostracio.
 * No esta pensat per a dades de produccio.
 *
 * Us: php artisan db:seed
 *
 * @package Database\Seeders
 */
class DatabaseSeeder extends Seeder
{
    /**
     * Executa els seeders de demostracio del projecte.
     *
     * Crida LunarBambesDemoSeeder que crea l'estructura completa
     * de Lunar: idioma, moneda, productes, variants, preus, etc.
     *
     * @return void
     */
    public function run(): void
    {
        $this->call(LunarBambesDemoSeeder::class);
    }
}
