<?php

namespace App\Models;

use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Asset extends Model
{
    use SoftDeletes;

    protected $fillable = ['inventory_number', 'name', 'category_id', 'supplier_id', 'location_id', 'brand', 'model', 'serial_number', 'acquired_at', 'acquisition_price', 'warranty_ends_at', 'condition', 'status', 'assigned_to', 'notes', 'image_path'];
    protected function casts(): array { return ['acquired_at' => 'date', 'warranty_ends_at' => 'date', 'acquisition_price' => 'decimal:2']; }
    public function category(): BelongsTo { return $this->belongsTo(Category::class); }
    public function supplier(): BelongsTo { return $this->belongsTo(Supplier::class); }
    public function location(): BelongsTo { return $this->belongsTo(Location::class); }
    public function maintenances(): HasMany { return $this->hasMany(AssetMaintenance::class); }
}
