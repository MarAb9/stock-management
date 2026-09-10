<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class InventorySession extends Model
{
    protected $fillable = ['name', 'location_id', 'status', 'started_at', 'validated_at', 'validated_by', 'notes', 'last_movement_id'];
    protected function casts(): array { return ['started_at' => 'date', 'validated_at' => 'datetime']; }
    public function lines(): HasMany { return $this->hasMany(InventoryLine::class); }
}
