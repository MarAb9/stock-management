<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
class InstitutionSetting extends Model {
    protected $fillable = ['name', 'address', 'phone', 'email', 'logo_path'];
    protected $hidden = ['logo_path'];
}
