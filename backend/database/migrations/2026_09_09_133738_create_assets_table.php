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
        Schema::create('assets', function (Blueprint $table): void {
            $table->id();
            $table->string('inventory_number')->unique();
            $table->string('name');
            $table->foreignId('category_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('supplier_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('location_id')->nullable()->constrained()->nullOnDelete();
            $table->string('brand')->nullable();
            $table->string('model')->nullable();
            $table->string('serial_number')->nullable()->unique();
            $table->date('acquired_at')->nullable();
            $table->decimal('acquisition_price', 14, 2)->nullable();
            $table->date('warranty_ends_at')->nullable();
            $table->enum('condition', ['new', 'very_good', 'good', 'fair', 'repair', 'out_of_service', 'retired'])->default('good');
            $table->enum('status', ['available', 'assigned', 'maintenance', 'out_of_service', 'retired'])->default('available');
            $table->string('assigned_to')->nullable();
            $table->text('notes')->nullable();
            $table->string('image_path')->nullable();
            $table->timestamps();
            $table->softDeletes();
            $table->index(['status', 'location_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('assets');
    }
};
