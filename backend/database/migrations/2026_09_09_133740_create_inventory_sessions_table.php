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
        Schema::create('inventory_sessions', function (Blueprint $table): void {
            $table->id();
            $table->string('name');
            $table->foreignId('location_id')->nullable()->constrained()->nullOnDelete();
            $table->enum('status', ['draft', 'in_progress', 'validated', 'cancelled'])->default('draft');
            $table->date('started_at')->nullable();
            $table->timestamp('validated_at')->nullable();
            $table->foreignId('validated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('notes')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('inventory_sessions');
    }
};
