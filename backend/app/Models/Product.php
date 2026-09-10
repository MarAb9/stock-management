<?php

namespace App\Models;

use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Model;

class Product extends Model
{
    use SoftDeletes;

    protected $fillable = ['reference', 'name', 'description', 'category_id', 'unit_id', 'supplier_id', 'minimum_stock', 'maximum_stock', 'purchase_price', 'barcode', 'track_lots', 'active', 'image_path'];
    protected function casts(): array { return ['track_lots' => 'boolean', 'active' => 'boolean', 'minimum_stock' => 'decimal:3', 'maximum_stock' => 'decimal:3', 'purchase_price' => 'decimal:2']; }
    public function category(): BelongsTo { return $this->belongsTo(Category::class); }
    public function unit(): BelongsTo { return $this->belongsTo(Unit::class); }
    public function supplier(): BelongsTo { return $this->belongsTo(Supplier::class); }
    public function balances(): HasMany { return $this->hasMany(StockBalance::class); }
    public function lots(): HasMany { return $this->hasMany(StockLot::class); }
}
