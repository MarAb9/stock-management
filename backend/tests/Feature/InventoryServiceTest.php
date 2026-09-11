<?php

namespace Tests\Feature;

use App\Models\Location;
use App\Models\Product;
use App\Models\StockBalance;
use App\Models\StockMovement;
use App\Models\Unit;
use App\Models\User;
use App\Services\InventoryService;
use App\Services\StockService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class InventoryServiceTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_snapshots_stock_by_location_and_lot(): void
    {
        [$user, $paper, $store, $office] = $this->context();
        $food = Product::create(['reference' => 'FOOD', 'name' => 'Cafe', 'unit_id' => $paper->unit_id, 'track_lots' => true]);
        $lot = $food->lots()->create(['lot_number' => 'LOT-1']);
        StockBalance::create(['product_id' => $paper->id, 'location_id' => $store->id, 'quantity' => '7.000']);
        StockBalance::create(['product_id' => $paper->id, 'location_id' => $office->id, 'quantity' => '2.000']);
        StockBalance::create(['product_id' => $food->id, 'location_id' => $store->id, 'stock_lot_id' => $lot->id, 'quantity' => '3.500']);

        $session = app(InventoryService::class)->create(['name' => 'Inventaire magasin', 'location_id' => $store->id], $this->request($user));

        $this->assertSame('in_progress', $session->status);
        $this->assertSame(2, $session->lines()->count());
        $this->assertDatabaseHas('inventory_lines', [
            'inventory_session_id' => $session->id,
            'product_id' => $paper->id,
            'location_id' => $store->id,
            'stock_lot_id' => null,
            'theoretical_quantity' => '7.000',
        ]);
        $this->assertDatabaseHas('inventory_lines', [
            'inventory_session_id' => $session->id,
            'product_id' => $food->id,
            'location_id' => $store->id,
            'stock_lot_id' => $lot->id,
            'theoretical_quantity' => '3.500',
        ]);
    }

    public function test_counting_requires_a_reason_for_variance(): void
    {
        [$user, $product, $store] = $this->context();
        StockBalance::create(['product_id' => $product->id, 'location_id' => $store->id, 'quantity' => '5.000']);
        $service = app(InventoryService::class);
        $session = $service->create(['name' => 'Inventaire'], $this->request($user));
        $line = $session->lines()->sole();

        $this->expectException(ValidationException::class);
        $service->count($this->request($user, ['physical_quantity' => '4.000']), $session, $line);
    }

    public function test_validation_creates_traceable_adjustments_and_refuses_repeat_validation(): void
    {
        [$user, $product, $store] = $this->context();
        StockBalance::create(['product_id' => $product->id, 'location_id' => $store->id, 'quantity' => '5.000']);
        $service = app(InventoryService::class);
        $session = $service->create(['name' => 'Inventaire'], $this->request($user));
        $line = $service->count($this->request($user, ['physical_quantity' => '3.000', 'reason' => 'Comptage physique', 'comment' => 'Deux pieces manquantes']), $session, $session->lines()->sole());

        $validated = $service->validate($this->request($user), $session);
        $adjustment = StockMovement::where('type', 'adjustment')->sole();

        $this->assertSame('validated', $validated->status);
        $this->assertSame($adjustment->id, $line->fresh()->adjustment_id);
        $this->assertSame('decrease', $adjustment->direction);
        $this->assertSame('2.000', $adjustment->quantity);
        $this->assertSame('3.000', StockBalance::where(['product_id' => $product->id, 'location_id' => $store->id])->sole()->quantity);
        $this->assertDatabaseHas('audit_logs', ['action' => 'inventory.validated', 'auditable_id' => $session->id, 'user_id' => $user->id]);

        $this->expectException(ValidationException::class);
        $service->validate($this->request($user), $session);
    }

    public function test_validation_rejects_uncounted_or_stale_sessions_without_adjustments(): void
    {
        [$user, $product, $store] = $this->context();
        StockBalance::create(['product_id' => $product->id, 'location_id' => $store->id, 'quantity' => '5.000']);
        $service = app(InventoryService::class);
        $session = $service->create(['name' => 'Inventaire'], $this->request($user));

        try {
            $service->validate($this->request($user), $session);
            $this->fail('Expected uncounted inventory validation to fail.');
        } catch (ValidationException $exception) {
            $this->assertArrayHasKey('physical_quantity', $exception->errors());
        }

        $line = $service->count($this->request($user, ['physical_quantity' => '4.000', 'reason' => 'Comptage physique']), $session, $session->lines()->sole());
        app(StockService::class)->record(['product_id' => $product->id, 'type' => 'entry', 'quantity' => '1.000', 'destination_location_id' => $store->id], $user);

        try {
            $service->validate($this->request($user), $session);
            $this->fail('Expected stale inventory validation to fail.');
        } catch (ValidationException $exception) {
            $this->assertArrayHasKey('session', $exception->errors());
        }

        $this->assertNull($line->fresh()->adjustment_id);
        $this->assertSame('in_progress', $session->fresh()->status);
        $this->assertDatabaseMissing('stock_movements', ['type' => 'adjustment']);
    }

    /** @return array{User, Product, Location, Location} */
    private function context(): array
    {
        $user = User::factory()->create();
        $unit = Unit::create(['name' => 'Piece', 'symbol' => 'pc']);
        $product = Product::create(['reference' => 'PAPER', 'name' => 'Papier', 'unit_id' => $unit->id]);

        return [$user, $product, Location::create(['name' => 'Magasin', 'code' => 'MAG']), Location::create(['name' => 'Bureau', 'code' => 'BUR'])];
    }

    private function request(User $user, array $data = []): Request
    {
        $request = Request::create('/api/inventory-sessions', 'POST', $data);
        $request->setUserResolver(fn () => $user);

        return $request;
    }
}
