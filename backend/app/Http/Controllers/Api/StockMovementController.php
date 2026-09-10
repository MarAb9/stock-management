<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreMovementRequest;
use App\Models\StockMovement;
use App\Services\AuditService;
use App\Services\StockService;
use Illuminate\Http\Request;

class StockMovementController extends Controller
{
    public function index(Request $request)
    {
        return StockMovement::query()->with(['product', 'sourceLocation', 'destinationLocation', 'lot', 'user'])
            ->when($request->type, fn ($q, $type) => $q->where('type', $type))->when($request->product_id, fn ($q, $id) => $q->where('product_id', $id))
            ->when($request->from, fn ($q, $date) => $q->whereDate('performed_at', '>=', $date))->when($request->to, fn ($q, $date) => $q->whereDate('performed_at', '<=', $date))
            ->latest('performed_at')->paginate($request->integer('per_page', 20));
    }

    public function store(StoreMovementRequest $request, StockService $stock, AuditService $audit)
    {
        $movement = $stock->record($request->validated(), $request->user());
        return response()->json($movement, 201);
    }
}
