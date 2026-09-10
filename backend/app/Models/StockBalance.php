<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StockBalance extends Model
{
    public function location() { return $this->belongsTo(Location::class); }
    public function product() { return $this->belongsTo(Product::class)->withTrashed(); }
    protected $fillable = ['product_id', 'location_id', 'stock_lot_id', 'quantity'];
    protected function casts(): array { return ['quantity' => 'decimal:3']; }
    public function lot(): BelongsTo { return $this->belongsTo(StockLot::class, 'stock_lot_id'); }
}
