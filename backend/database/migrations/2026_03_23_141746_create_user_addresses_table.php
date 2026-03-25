<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('user_addresses', function (Blueprint $table) {
            $table->id();

            $table->integer('user_id');

            $table->string('label');
            $table->string('first_name');
            $table->string('last_name');
            $table->string('contact_email')->nullable();
            $table->string('contact_phone')->nullable();

            $table->string('line_one');
            $table->string('line_two')->nullable();
            $table->string('city');
            $table->string('state')->nullable();
            $table->string('postcode', 20);
            $table->string('country_code', 2)->default('ES');

            $table->boolean('is_default')->default(false);

            $table->timestamps();

            $table->foreign('user_id')
                ->references('id')
                ->on('users')
                ->onDelete('cascade');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_addresses');
    }
};