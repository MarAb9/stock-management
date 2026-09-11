<?php

namespace Tests\Feature;

use App\Models\Location;
use App\Models\Product;
use App\Models\StockBalance;
use App\Models\StockMovement;
use App\Models\Unit;
use App\Models\User;
use App\Services\StockService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class StockServiceTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_tracks_transfers_and_rejects_negative_stock(): void
    {
        $user = User::factory()->create();
        $unit = Unit::create(['name' => 'Pièce', 'symbol' => 'pc']);
        $store = Location::create(['name' => 'Magasin', 'code' => 'MAG']);
        $office = Location::create(['name' => 'Bureau 01', 'code' => 'B01']);
        $product = Product::create(['reference' => 'PAP-A4', 'name' => 'Papier A4', 'unit_id' => $unit->id, 'minimum_stock' => 1]);
        $stock = app(StockService::class);

        $stock->record(['product_id' => $product->id, 'type' => 'entry', 'quantity' => 10, 'destination_location_id' => $store->id], $user);
        $stock->record(['product_id' => $product->id, 'type' => 'transfer', 'quantity' => 4, 'source_location_id' => $store->id, 'destination_location_id' => $office->id], $user);

        $this->assertSame('6.000', StockBalance::where(['product_id' => $product->id, 'location_id' => $store->id])->value('quantity'));
        $this->assertSame('4.000', StockBalance::where(['product_id' => $product->id, 'location_id' => $office->id])->value('quantity'));
        $this->expectException(ValidationException::class);
        $stock->record(['product_id' => $product->id, 'type' => 'exit', 'quantity' => 7, 'source_location_id' => $store->id], $user);
    }

    public function test_decimal_quantities_are_exact_and_invalid_precision_is_rejected(): void
    {
        [$user, $product, $source, $destination] = $this->stockContext();
        $stock = app(StockService::class);
        foreach (['0.100', '0.200'] as $quantity) {
            $stock->record(['product_id' => $product->id, 'type' => 'entry', 'quantity' => $quantity, 'destination_location_id' => $source->id], $user);
        }
        $movement = $stock->record(['product_id' => $product->id, 'type' => 'transfer', 'quantity' => '0.299', 'source_location_id' => $source->id, 'destination_location_id' => $destination->id], $user);
        $this->assertSame('0.299', $movement->fresh()->quantity);
        $this->assertSame('0.001', StockBalance::where('location_id', $source->id)->sole()->quantity);
        $this->assertSame('0.299', StockBalance::where('location_id', $destination->id)->sole()->quantity);
        foreach (['0', '-0.001', '0.0001', '1e-3', '100000000000.000'] as $quantity) {
            $this->assertRejectedWithoutChanges(['product_id' => $product->id, 'type' => 'entry', 'quantity' => $quantity, 'destination_location_id' => $source->id], $user, 'quantity');
        }
    }

    public function test_lots_must_belong_to_a_lot_tracked_product(): void
    {
        [$user, $product, $source] = $this->stockContext();
        $other = $product->replicate();
        $other->reference = 'OTHER';
        $other->save();
        $foreignLot = $other->lots()->create(['lot_number' => 'FOREIGN']);
        $ownLot = $product->lots()->create(['lot_number' => 'OWN']);
        $entry = ['product_id' => $product->id, 'type' => 'entry', 'quantity' => '1', 'destination_location_id' => $source->id];
        $this->assertRejectedWithoutChanges($entry + ['stock_lot_id' => $ownLot->id], $user, 'stock_lot_id');
        $product->update(['track_lots' => true]);
        $this->assertRejectedWithoutChanges($entry + ['stock_lot_id' => $foreignLot->id], $user, 'stock_lot_id');
        $this->assertRejectedWithoutChanges($entry, $user, 'lot_number');
        $this->assertRejectedWithoutChanges($entry + ['lot_number' => 'OWN'], $user, 'lot_number');
        app(StockService::class)->record($entry + ['stock_lot_id' => $ownLot->id], $user);
        $this->assertSame($ownLot->id, StockBalance::sole()->stock_lot_id);
        foreach (['return', 'adjustment'] as $type) {
            $this->assertRejectedWithoutChanges(array_replace($entry, ['type' => $type, 'direction' => 'increase', 'reason' => 'Count']), $user, 'stock_lot_id');
        }
    }

    public function test_direct_calls_validate_lot_dates_and_rollback_new_expired_lots(): void
    {
        [$user, $product, $source] = $this->stockContext(true);
        $entry = ['product_id' => $product->id, 'type' => 'entry', 'quantity' => '1', 'destination_location_id' => $source->id, 'lot_number' => 'NEW'];
        $this->assertRejectedWithoutChanges($entry + ['produced_at' => today()->addDays(2)->toDateString(), 'expires_at' => today()->addDay()->toDateString()], $user, 'expires_at');
        $this->assertRejectedWithoutChanges($entry + ['expires_at' => today()->subDay()->toDateString()], $user, 'stock_lot_id');
        app(StockService::class)->record($entry + ['produced_at' => today()->toDateString(), 'expires_at' => today()->toDateString()], $user);
        $this->assertDatabaseCount('stock_lots', 1);
    }

    public function test_expired_lots_are_rejected_except_for_loss_disposal_and_adjustments(): void
    {
        [$user, $product, $source, $destination] = $this->stockContext(true);
        $lot = $product->lots()->create(['lot_number' => 'EXPIRED', 'expires_at' => today()->subDay()]);
        $balance = StockBalance::create(['product_id' => $product->id, 'stock_lot_id' => $lot->id, 'location_id' => $source->id, 'quantity' => '5']);
        foreach (['entry', 'return', 'exit', 'transfer'] as $type) {
            $this->assertRejectedWithoutChanges(['product_id' => $product->id, 'stock_lot_id' => $lot->id, 'type' => $type, 'quantity' => '1', 'source_location_id' => $source->id, 'destination_location_id' => $destination->id], $user, 'stock_lot_id');
        }
        foreach (['loss', 'disposal', 'adjustment'] as $type) {
            app(StockService::class)->record(['product_id' => $product->id, 'stock_lot_id' => $lot->id, 'type' => $type, 'direction' => 'decrease', 'reason' => 'Expired', 'quantity' => '1', 'source_location_id' => $source->id], $user);
        }
        $this->assertSame('2.000', $balance->fresh()->quantity);
        $this->assertDatabaseCount('stock_movements', 3);
        $this->assertDatabaseCount('audit_logs', 3);
    }

    public function test_fefo_spans_lots_preserves_movements_and_audits_and_puts_undated_lots_last(): void
    {
        [$user, $product, $source, $destination] = $this->stockContext(true);
        $lots = [];
        foreach (['undated' => null, 'later' => today()->addDay(), 'today' => today(), 'expired' => today()->subDay()] as $name => $expiry) {
            $lots[$name] = $product->lots()->create(['lot_number' => $name, 'expires_at' => $expiry]);
            StockBalance::create(['product_id' => $product->id, 'location_id' => $source->id, 'stock_lot_id' => $lots[$name]->id, 'quantity' => '0.100']);
        }
        $first = app(StockService::class)->record(['product_id' => $product->id, 'type' => 'transfer', 'quantity' => '0.250', 'source_location_id' => $source->id, 'destination_location_id' => $destination->id, 'notes' => 'FEFO'], $user);
        $movements = StockMovement::orderBy('id')->get();
        $this->assertSame([$lots['today']->id, $lots['later']->id, $lots['undated']->id], $movements->pluck('stock_lot_id')->all());
        $this->assertSame(['0.100', '0.100', '0.050'], $movements->pluck('quantity')->all());
        $this->assertSame($first->id, $movements->first()->id);
        $this->assertNotEmpty($first->operation_reference);
        $this->assertCount(1, $movements->pluck('operation_reference')->unique());
        foreach ($movements as $movement) {
            $this->assertSame('FEFO', $movement->notes);
            $this->assertSame($user->id, $movement->user_id);
            $this->assertSame($movement->quantity, StockBalance::where(['stock_lot_id' => $movement->stock_lot_id, 'location_id' => $destination->id])->sole()->quantity);
            $this->assertSame(bcsub('0.100', $movement->quantity, 3), StockBalance::where(['stock_lot_id' => $movement->stock_lot_id, 'location_id' => $source->id])->sole()->quantity);
            $this->assertDatabaseHas('audit_logs', ['auditable_type' => StockMovement::class, 'auditable_id' => $movement->id, 'user_id' => $user->id, 'action' => 'stock.transfer']);
        }
        $this->assertDatabaseCount('audit_logs', 3);
        $this->assertSame('0.100', StockBalance::where('stock_lot_id', $lots['expired']->id)->sole()->quantity);
        $this->assertRejectedWithoutChanges(['product_id' => $product->id, 'type' => 'exit', 'quantity' => '0.051', 'source_location_id' => $source->id], $user, 'quantity');
    }

    public function test_insufficient_explicit_stock_rolls_back_even_a_new_balance(): void
    {
        [$user, $product, $source, $destination] = $this->stockContext();
        $transfer = ['product_id' => $product->id, 'type' => 'transfer', 'quantity' => '1.001', 'source_location_id' => $source->id, 'destination_location_id' => $destination->id];
        $this->assertRejectedWithoutChanges($transfer, $user, 'quantity');
        app(StockService::class)->record(['product_id' => $product->id, 'type' => 'entry', 'quantity' => '1', 'destination_location_id' => $source->id], $user);
        $this->assertRejectedWithoutChanges($transfer, $user, 'quantity');
    }

    public function test_overflow_on_second_fefo_lot_rolls_back_all_balances_movements_and_audits(): void
    {
        [$user, $product, $source, $destination] = $this->stockContext(true);
        foreach (['FIRST', 'SECOND'] as $name) {
            $lot = $product->lots()->create(['lot_number' => $name, 'expires_at' => today()]);
            StockBalance::create(['product_id' => $product->id, 'location_id' => $source->id, 'stock_lot_id' => $lot->id, 'quantity' => '0.001']);
        }
        app(StockService::class)->record(['product_id' => $product->id, 'stock_lot_id' => $lot->id, 'type' => 'entry', 'quantity' => '99999999999.999', 'destination_location_id' => $destination->id], $user);
        $this->assertSame('99999999999.999', StockBalance::where('location_id', $destination->id)->sole()->quantity);
        $this->assertRejectedWithoutChanges(['product_id' => $product->id, 'type' => 'transfer', 'quantity' => '0.002', 'source_location_id' => $source->id, 'destination_location_id' => $destination->id], $user, 'quantity');
    }

    /** @return array{User, Product, Location, Location} */
    private function stockContext(bool $trackLots = false): array
    {
        $user = User::factory()->create();
        $unit = Unit::create(['name' => 'Piece', 'symbol' => 'pc']);
        $product = Product::create(['reference' => 'TEST', 'name' => 'Test', 'unit_id' => $unit->id, 'track_lots' => $trackLots]);

        return [$user, $product, Location::create(['name' => 'Source', 'code' => 'SRC']), Location::create(['name' => 'Destination', 'code' => 'DST'])];
    }

    private function assertRejectedWithoutChanges(array $data, User $user, string $field): void
    {
        $tables = ['stock_balances', 'stock_lots', 'stock_movements', 'audit_logs'];
        $before = [];
        foreach ($tables as $table) {
            $before[$table] = DB::table($table)->orderBy('id')->get()->toJson();
        }
        try {
            app(StockService::class)->record($data, $user);
            $this->fail('Expected stock movement validation to fail.');
        } catch (ValidationException $exception) {
            $this->assertArrayHasKey($field, $exception->errors());
        }
        foreach ($tables as $table) {
            $this->assertSame($before[$table], DB::table($table)->orderBy('id')->get()->toJson(), $table.' changed after rejection');
        }
    }
}
