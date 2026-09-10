<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('inventory_lines', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('inventory_session_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_id')->constrained()->restrictOnDelete();
            $table->foreignId('location_id')->nullable()->constrained()->nullOnDelete();
            $table->decimal('theoretical_quantity', 14, 3);
            $table->decimal('physical_quantity', 14, 3)->nullable();
            $table->decimal('variance', 14, 3)->nullable();
            $table->string('reason')->nullable();
            $table->text('comment')->nullable();
            $table->timestamps();
            $table->unique(['inventory_session_id', 'product_id', 'location_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('inventory_lines');
    }
};
