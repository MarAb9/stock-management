<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Asset;
use App\Models\Product;
use App\Models\StockBalance;
use App\Models\StockLot;
use App\Models\StockMovement;
use Illuminate\Support\Facades\DB;

class DashboardController extends Controller
{
    public function __invoke()
    {
        $balances = StockBalance::query()->selectRaw('product_id, sum(quantity) as total')->groupBy('product_id');
        $low = Product::query()->leftJoinSub($balances, 'balance_totals', fn ($join) => $join->on('products.id', '=', 'balance_totals.product_id'))->whereRaw('coalesce(balance_totals.total, 0) <= products.minimum_stock');
        return [
            'products' => Product::count(), 'assets' => Asset::count(), 'stock_quantity' => StockBalance::sum('quantity'),
            'low_stock' => $low->count(), 'out_of_stock' => Product::query()->whereDoesntHave('balances', fn ($q) => $q->where('quantity', '>', 0))->count(),
            'expiring_lots' => StockLot::whereBetween('expires_at', [today(), today()->addDays(30)])->count(), 'expired_lots' => StockLot::whereDate('expires_at', '<', today())->count(),
            'assets_in_maintenance' => Asset::where('status', 'maintenance')->count(), 'assets_out_of_service' => Asset::where('status', 'out_of_service')->count(),
            'recent_movements' => StockMovement::with('product')->latest('performed_at')->limit(8)->get(),
        ];
    }
}
