<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('product_colors', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')
                  ->constrained('lunar_products')
                  ->cascadeOnDelete();
            $table->string('name', 100);   // Stored uppercase: "BLANC", "NEGRE"
            $table->json('sizes');          // ["41", "42", "43"]
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();

            $table->unique(['product_id', 'name']); // One record per color per product
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('product_colors');
    }
};
