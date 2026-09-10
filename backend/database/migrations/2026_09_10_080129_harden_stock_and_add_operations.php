<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\{DB, Schema};

return new class extends Migration {
    public function up(): void
    {
        Schema::table('stock_movements', function (Blueprint $t) { $t->string('operation_reference')->nullable()->index(); });
        Schema::table('inventory_sessions', function (Blueprint $t) { $t->unsignedBigInteger('last_movement_id')->default(0); });
        Schema::table('inventory_lines', function (Blueprint $t) {
            $t->dropUnique(['inventory_session_id', 'product_id', 'location_id']);
            $t->foreignId('stock_lot_id')->nullable()->constrained()->restrictOnDelete();
            $t->foreignId('adjustment_id')->nullable()->constrained('stock_movements')->restrictOnDelete();
            $t->unique(['inventory_session_id', 'product_id', 'location_id', 'stock_lot_id'], 'inventory_line_lot_unique');
        });
        Schema::create('asset_operations', function (Blueprint $t) {
            $t->id(); $t->string('reference')->unique(); $t->foreignId('asset_id')->constrained()->restrictOnDelete();
            $t->string('type', 32); $t->foreignId('source_location_id')->nullable()->constrained('locations')->restrictOnDelete();
            $t->foreignId('destination_location_id')->nullable()->constrained('locations')->restrictOnDelete();
            $t->string('assigned_to')->nullable(); $t->string('reason'); $t->text('notes')->nullable();
            $t->json('snapshot'); $t->foreignId('user_id')->constrained()->restrictOnDelete(); $t->timestamps();
            $t->index(['asset_id', 'created_at']);
        });
        Schema::create('attachments', function (Blueprint $t) {
            $t->id(); $t->string('entity_type', 32); $t->unsignedBigInteger('entity_id');
            $t->string('name'); $t->string('path'); $t->string('mime'); $t->unsignedBigInteger('size');
            $t->foreignId('user_id')->constrained()->restrictOnDelete(); $t->timestamps(); $t->index(['entity_type', 'entity_id']);
        });
        Schema::create('institution_settings', function (Blueprint $t) {
            $t->id(); $t->string('name'); $t->text('address')->nullable(); $t->string('phone')->nullable();
            $t->string('email')->nullable(); $t->string('logo_path')->nullable(); $t->timestamps();
        });
        DB::table('institution_settings')->insert(['id' => 1, 'name' => 'Conseil Scientifique Local de Berkane', 'created_at' => now(), 'updated_at' => now()]);
        DB::statement('CREATE UNIQUE INDEX stock_balance_without_lot ON stock_balances (product_id, location_id) WHERE stock_lot_id IS NULL');
        DB::statement('CREATE UNIQUE INDEX inventory_line_without_lot ON inventory_lines (inventory_session_id, product_id, location_id) WHERE stock_lot_id IS NULL');
        // Remove secrets written by the previous audit implementation before making the log immutable.
        DB::table('audit_logs')->where('auditable_type', App\Models\User::class)->orderBy('id')->each(function ($log) {
            $clean = fn ($json) => $json ? json_encode(array_diff_key(json_decode($json, true), array_flip(['password', 'remember_token']))) : null;
            DB::table('audit_logs')->where('id', $log->id)->update(['old_values' => $clean($log->old_values), 'new_values' => $clean($log->new_values)]);
        });
        if (DB::getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE stock_balances ADD CONSTRAINT stock_nonnegative CHECK (quantity >= 0)');
            DB::statement('ALTER TABLE stock_movements ADD CONSTRAINT movement_positive CHECK (quantity > 0)');
            DB::statement("ALTER TABLE stock_movements ADD CONSTRAINT movement_locations CHECK (
                (type IN ('entry','return') AND source_location_id IS NULL AND destination_location_id IS NOT NULL) OR
                (type IN ('exit','loss','disposal') AND source_location_id IS NOT NULL AND destination_location_id IS NULL) OR
                (type = 'transfer' AND source_location_id IS NOT NULL AND destination_location_id IS NOT NULL AND source_location_id <> destination_location_id) OR
                (type = 'adjustment' AND ((direction = 'increase' AND destination_location_id IS NOT NULL AND source_location_id IS NULL) OR (direction = 'decrease' AND source_location_id IS NOT NULL AND destination_location_id IS NULL))))");
            DB::statement('ALTER TABLE inventory_lines ADD CONSTRAINT counted_nonnegative CHECK (physical_quantity >= 0)');
            DB::statement('ALTER TABLE stock_lots ADD CONSTRAINT lot_dates CHECK (expires_at >= produced_at)');
            DB::unprepared("CREATE FUNCTION reject_history_change() RETURNS trigger LANGUAGE plpgsql AS 'BEGIN RAISE EXCEPTION ''Historical records are immutable''; END;'");
            foreach (['stock_movements', 'audit_logs', 'asset_operations'] as $table) {
                DB::unprepared("CREATE TRIGGER immutable_history BEFORE UPDATE OR DELETE ON {$table} FOR EACH ROW EXECUTE FUNCTION reject_history_change()");
            }
        }
    }
    public function down(): void
    {
        if (DB::getDriverName() === 'pgsql') {
            foreach (['stock_movements', 'audit_logs', 'asset_operations'] as $table) { DB::statement("DROP TRIGGER IF EXISTS immutable_history ON {$table}"); }
            DB::statement('DROP FUNCTION IF EXISTS reject_history_change()');
            DB::statement('ALTER TABLE stock_balances DROP CONSTRAINT stock_nonnegative');
            DB::statement('ALTER TABLE stock_movements DROP CONSTRAINT movement_positive, DROP CONSTRAINT movement_locations');
            DB::statement('ALTER TABLE stock_lots DROP CONSTRAINT lot_dates');
            DB::statement('ALTER TABLE inventory_lines DROP CONSTRAINT counted_nonnegative');
        }
        Schema::dropIfExists('attachments'); Schema::dropIfExists('asset_operations'); Schema::dropIfExists('institution_settings');
        DB::statement('DROP INDEX IF EXISTS stock_balance_without_lot'); DB::statement('DROP INDEX IF EXISTS inventory_line_without_lot');
        Schema::table('inventory_lines', function (Blueprint $t) { $t->dropUnique('inventory_line_lot_unique'); $t->dropConstrainedForeignId('stock_lot_id'); $t->dropConstrainedForeignId('adjustment_id'); });
        Schema::table('inventory_sessions', fn (Blueprint $t) => $t->dropColumn('last_movement_id'));
        Schema::table('stock_movements', fn (Blueprint $t) => $t->dropColumn('operation_reference'));
    }
};
