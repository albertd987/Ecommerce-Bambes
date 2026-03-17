<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('lunar_products', function (Blueprint $table) {
            $table->foreignId('thumbnail_id')->nullable()->after('brand_id')->constrained('media')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('lunar_products', function (Blueprint $table) {
            $table->dropForeign(['thumbnail_id']);
            $table->dropColumn('thumbnail_id');
        });
    }
};