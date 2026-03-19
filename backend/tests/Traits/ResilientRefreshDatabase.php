<?php

namespace Tests\Traits;

use Illuminate\Contracts\Console\Kernel;
use Illuminate\Foundation\Testing\DatabaseTransactionsManager;
use Illuminate\Foundation\Testing\RefreshDatabaseState;
use Illuminate\Foundation\Testing\Traits\CanConfigureMigrationCommands;

/**
 * A resilient version of RefreshDatabase that retries migrate:fresh once
 * if it fails due to concurrent test runs causing MySQL lock conflicts.
 */
trait ResilientRefreshDatabase
{
    use CanConfigureMigrationCommands;

    public function refreshDatabase(): void
    {
        $this->beforeRefreshingDatabase();

        if (! RefreshDatabaseState::$migrated) {
            try {
                $this->artisan('migrate:fresh', $this->migrateFreshUsing());
                $this->app[Kernel::class]->setArtisan(null);
                RefreshDatabaseState::$migrated = true;
            } catch (\Throwable $e) {
                // Concurrent test suites can wipe the DB mid-run (deadlock).
                // Purge all connections and retry once with a clean slate.
                $this->app->make('db')->purge();
                $this->artisan('migrate:fresh', $this->migrateFreshUsing());
                $this->app[Kernel::class]->setArtisan(null);
                RefreshDatabaseState::$migrated = true;
            }
        }

        $this->beginDatabaseTransaction();
        $this->afterRefreshingDatabase();
    }

    public function beginDatabaseTransaction(): void
    {
        $database = $this->app->make('db');
        $connections = $this->connectionsToTransact();

        $this->app->instance('db.transactions', $transactionsManager = new DatabaseTransactionsManager($connections));

        foreach ($connections as $name) {
            $connection = $database->connection($name);
            $connection->setTransactionManager($transactionsManager);

            $dispatcher = $connection->getEventDispatcher();
            $connection->unsetEventDispatcher();
            $connection->beginTransaction();
            $connection->setEventDispatcher($dispatcher);
        }

        $this->beforeApplicationDestroyed(function () use ($database) {
            foreach ($this->connectionsToTransact() as $name) {
                $connection = $database->connection($name);
                $dispatcher = $connection->getEventDispatcher();

                $connection->unsetEventDispatcher();

                if ($connection->getPdo() && ! $connection->getPdo()->inTransaction()) {
                    RefreshDatabaseState::$migrated = false;
                }

                $connection->rollBack();
                $connection->setEventDispatcher($dispatcher);
                $connection->disconnect();
            }
        });
    }

    protected function connectionsToTransact(): array
    {
        return property_exists($this, 'connectionsToTransact')
            ? $this->connectionsToTransact
            : [null];
    }

    protected function beforeRefreshingDatabase(): void {}

    protected function afterRefreshingDatabase(): void {}
}
