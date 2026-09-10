<?php

namespace Database\Seeders;

use App\Models\Category;
use App\Models\Location;
use App\Models\Unit;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        User::updateOrCreate(['email' => env('LOCAL_ADMIN_EMAIL', 'admin@csl-berkane.local')], ['name' => 'Administrateur CSL Berkane', 'password' => Hash::make(env('LOCAL_ADMIN_PASSWORD', 'change-me-local'))]);
        foreach ([['Mobilier', 'MOB'], ['Matériel informatique', 'INFO'], ['Fournitures de bureau', 'FOUR'], ['Produits alimentaires', 'ALIM'], ['Produits d’entretien', 'ENT']] as [$name, $code]) { Category::updateOrCreate(['code' => $code], ['name' => $name, 'active' => true]); }
        foreach ([['Pièce', 'pc'], ['Boîte', 'boite'], ['Carton', 'carton'], ['Ramette', 'ramette'], ['Litre', 'l'], ['Kilogramme', 'kg']] as [$name, $symbol]) { Unit::updateOrCreate(['symbol' => $symbol], ['name' => $name, 'active' => true]); }
        foreach ([['Magasin', 'MAG'], ['Administration', 'ADM'], ['Salle de réunion', 'SR'], ['Bureau 01', 'B01'], ['Bureau 02', 'B02'], ['Bibliothèque', 'BIB']] as [$name, $code]) { Location::updateOrCreate(['code' => $code], ['name' => $name, 'active' => true]); }
    }
}
