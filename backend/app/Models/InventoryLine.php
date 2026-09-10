<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class InventoryLine extends Model
{
    protected $fillable = ['inventory_session_id', 'product_id', 'location_id', 'stock_lot_id', 'adjustment_id', 'theoretical_quantity', 'physical_quantity', 'variance', 'reason', 'comment'];
    public function product() { return $this->belongsTo(Product::class)->withTrashed(); }
    public function location() { return $this->belongsTo(Location::class); }
    public function lot() { return $this->belongsTo(StockLot::class, 'stock_lot_id'); }
    protected function casts(): array { return ['theoretical_quantity' => 'decimal:3', 'physical_quantity' => 'decimal:3', 'variance' => 'decimal:3']; }
}
