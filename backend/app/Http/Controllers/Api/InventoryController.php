<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\{InventoryLine, InventorySession, Product, StockBalance};
use App\Services\{AuditService, InventoryService};
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class InventoryController extends Controller
{
    public function index(Request $request) {
        return InventorySession::withCount('lines')->when($request->status, fn ($q, $v) => $q->where('status', $v))
            ->when($request->search, fn ($q, $v) => $q->whereLike('name', '%'.$v.'%'))->latest()->paginate(20);
    }
    public function store(Request $request, InventoryService $service) {
        $data = $request->validate(['name' => ['required', 'string', 'max:255'], 'location_id' => ['nullable', 'exists:locations,id'], 'notes' => ['nullable', 'string', 'max:5000']]);
        return response()->json($service->create($data, $request), 201);
    }
    public function show(InventorySession $inventorySession) { return $inventorySession; }
    public function lines(Request $request, InventorySession $inventorySession) {
        return $inventorySession->lines()->with(['product', 'location', 'lot'])->when($request->boolean('variance'), fn ($q) => $q->where('variance', '<>', 0))->orderBy('id')->paginate(50);
    }
    public function updateLine(Request $request, InventorySession $inventorySession, InventoryLine $line, InventoryService $service) {
        return $service->count($request, $inventorySession, $line);
    }
    public function validateSession(Request $request, InventorySession $inventorySession, InventoryService $service) {
        return $service->validate($request, $inventorySession);
    }
    public function cancel(Request $request, InventorySession $inventorySession, AuditService $audit) {
        return DB::transaction(function () use ($request, $inventorySession, $audit) {
            $session = InventorySession::lockForUpdate()->findOrFail($inventorySession->id);
            abort_unless($session->status === 'in_progress', 422, 'Cette session est déjà clôturée.');
            $session->update(['status' => 'cancelled']); $audit->log($request, 'inventory.cancelled', $session);
            return $session;
        });
    }
    public function addLine(Request $request, InventorySession $inventorySession) {
        $data = $request->validate(['product_id' => ['required', 'exists:products,id'], 'location_id' => ['required', 'exists:locations,id'], 'stock_lot_id' => ['nullable', 'exists:stock_lots,id']]);
        return DB::transaction(function () use ($inventorySession, $data) {
            $session = InventorySession::lockForUpdate()->findOrFail($inventorySession->id);
            abort_unless($session->status === 'in_progress', 422, 'Session clôturée.');
            abort_if($session->location_id && (int) $session->location_id !== (int) $data['location_id'], 422, 'Emplacement hors du périmètre.');
            $product = Product::lockForUpdate()->findOrFail($data['product_id']);
            abort_if($product->track_lots && ! $product->lots()->where('id', $data['stock_lot_id'] ?? null)->exists(), 422, 'Sélectionnez un lot du produit.');
            abort_if(! $product->track_lots && ! empty($data['stock_lot_id']), 422, 'Ce produit ne gère pas les lots.');
            $key = $data + ['stock_lot_id' => null];
            abort_if($session->lines()->where($key)->exists(), 422, 'Cette ligne existe déjà.');
            $balance = StockBalance::where($key)->value('quantity') ?? '0';
            return $session->lines()->create($key + ['theoretical_quantity' => $balance]);
        });
    }
}
