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
        Schema::create('stock_lots', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('product_id')->constrained()->restrictOnDelete();
            $table->foreignId('supplier_id')->nullable()->constrained()->nullOnDelete();
            $table->string('lot_number');
            $table->date('received_at')->nullable();
            $table->date('produced_at')->nullable();
            $table->date('expires_at')->nullable();
            $table->decimal('purchase_price', 14, 2)->nullable();
            $table->timestamps();
            $table->unique(['product_id', 'lot_number']);
            $table->index(['product_id', 'expires_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('stock_lots');
    }
};
