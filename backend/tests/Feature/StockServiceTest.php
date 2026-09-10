<?php

namespace Tests\Feature;

use App\Models\Location;
use App\Models\Product;
use App\Models\StockBalance;
use App\Models\Unit;
use App\Models\User;
use App\Services\StockService;
use Illuminate\Foundation\Testing\RefreshDatabase;
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
}
