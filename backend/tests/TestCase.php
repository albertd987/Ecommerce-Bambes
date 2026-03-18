<?php

namespace Tests;

use Illuminate\Foundation\Testing\RefreshDatabaseState;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Illuminate\Support\Facades\DB;

abstract class TestCase extends BaseTestCase
{
    /**
     * Override refreshTestDatabase to skip migrate:fresh when the test
     * database is already fully migrated. This prevents failures with
     * complex Lunar migrations on MySQL.
     *
     * Pre-condition: run `php artisan migrate:fresh --env=testing --force`
     * before the test suite when the schema has changed.
     */
    protected function refreshTestDatabase()
    {
        if (! RefreshDatabaseState::$migrated) {
            try {
                $alreadyMigrated = DB::connection()
                    ->table('migrations')
                    ->where('migration', '2026_03_16_152044_create_favorites_table')
                    ->exists();

                if ($alreadyMigrated) {
                    RefreshDatabaseState::$migrated = true;
                }
            } catch (\Throwable) {
                // DB not ready — fall through to run migrate:fresh normally
            }
        }

        parent::refreshTestDatabase();
    }
}
