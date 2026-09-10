<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Supplier extends Model
{
    protected $fillable = ['name', 'company', 'contact_name', 'phone', 'email', 'address', 'ice', 'notes', 'active'];
}
