<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
class AssetOperation extends Model {
    protected $guarded = ['id'];
    protected function casts(): array { return ['snapshot' => 'array']; }
    public function asset() { return $this->belongsTo(Asset::class)->withTrashed(); }
    public function user() { return $this->belongsTo(User::class); }
    public function sourceLocation() { return $this->belongsTo(Location::class, 'source_location_id'); }
    public function destinationLocation() { return $this->belongsTo(Location::class, 'destination_location_id'); }
}
