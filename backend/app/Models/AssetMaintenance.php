<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AssetMaintenance extends Model
{
    protected $fillable = ['asset_id', 'performed_at', 'type', 'description', 'provider', 'cost', 'status', 'notes'];
    protected function casts(): array { return ['performed_at' => 'date', 'cost' => 'decimal:2']; }
}
