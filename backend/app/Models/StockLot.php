<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class StockLot extends Model
{
    public function product() { return $this->belongsTo(Product::class)->withTrashed(); }
    public function balances() { return $this->hasMany(StockBalance::class); }
    protected $fillable = ['product_id', 'supplier_id', 'lot_number', 'received_at', 'produced_at', 'expires_at', 'purchase_price'];
    protected function casts(): array { return ['received_at' => 'date', 'produced_at' => 'date', 'expires_at' => 'date', 'purchase_price' => 'decimal:2']; }
}
