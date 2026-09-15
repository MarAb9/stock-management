<?php

namespace Tests\Feature;

use App\Models\Location;
use App\Models\Product;
use App\Models\Unit;
use App\Models\User;
use App\Services\StockService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ProductControllerTest extends TestCase
{
    use RefreshDatabase;

    public function test_product_detail_reports_whether_immutable_configuration_is_locked(): void
    {
        $user = User::factory()->create();
        $unit = Unit::create(['name' => 'Pièce', 'symbol' => 'pce']);
        $location = Location::create(['name' => 'Magasin', 'code' => 'MAG']);
        $product = Product::create(['reference' => 'P-001', 'name' => 'Papier', 'unit_id' => $unit->id]);

        $this->actingAs($user)->getJson("/api/products/{$product->id}")
            ->assertOk()->assertJsonPath('has_movements', false);

        app(StockService::class)->record([
            'product_id' => $product->id,
            'type' => 'entry',
            'quantity' => '1.000',
            'destination_location_id' => $location->id,
        ], $user);

        $this->actingAs($user)->getJson("/api/products/{$product->id}")
            ->assertOk()->assertJsonPath('has_movements', true);
    }
}
