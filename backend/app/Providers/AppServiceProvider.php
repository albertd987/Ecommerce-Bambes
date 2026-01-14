<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;
use Lunar\Admin\Support\Facades\LunarPanel;
use Lunar\Models\ProductOptionValue as LunarProductOptionValue;
use App\Models\ProductOptionValue;


class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        LunarPanel::register();
    }

    public function boot(): void
    {

    }
}
