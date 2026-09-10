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
        Schema::create('stock_movements', function (Blueprint $table): void {
            $table->id();
            $table->string('reference')->unique();
            $table->foreignId('product_id')->constrained()->restrictOnDelete();
            $table->foreignId('stock_lot_id')->nullable()->constrained()->restrictOnDelete();
            $table->enum('type', ['entry', 'exit', 'return', 'transfer', 'adjustment', 'loss', 'disposal']);
            $table->enum('direction', ['increase', 'decrease'])->nullable();
            $table->decimal('quantity', 14, 3);
            $table->foreignId('source_location_id')->nullable()->constrained('locations')->restrictOnDelete();
            $table->foreignId('destination_location_id')->nullable()->constrained('locations')->restrictOnDelete();
            $table->foreignId('user_id')->constrained()->restrictOnDelete();
            $table->string('reason')->nullable();
            $table->text('notes')->nullable();
            $table->timestamp('performed_at');
            $table->timestamps();
            $table->index(['product_id', 'performed_at']);
            $table->index(['type', 'performed_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('stock_movements');
    }
};
