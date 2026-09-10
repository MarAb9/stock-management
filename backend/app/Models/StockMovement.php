<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StockMovement extends Model
{
    protected $fillable = ['reference', 'operation_reference', 'product_id', 'stock_lot_id', 'type', 'direction', 'quantity', 'source_location_id', 'destination_location_id', 'user_id', 'reason', 'notes', 'performed_at'];
    protected function casts(): array { return ['quantity' => 'decimal:3', 'performed_at' => 'datetime']; }
    public function product(): BelongsTo { return $this->belongsTo(Product::class)->withTrashed(); }
    public function lot(): BelongsTo { return $this->belongsTo(StockLot::class, 'stock_lot_id'); }
    public function sourceLocation(): BelongsTo { return $this->belongsTo(Location::class, 'source_location_id'); }
    public function destinationLocation(): BelongsTo { return $this->belongsTo(Location::class, 'destination_location_id'); }
    public function user(): BelongsTo { return $this->belongsTo(User::class); }
}
