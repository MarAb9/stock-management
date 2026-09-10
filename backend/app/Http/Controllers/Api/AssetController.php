<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\AssetRequest;
use App\Models\{Asset, AssetMaintenance, AssetOperation, AuditLog};
use App\Services\{AuditService, AssetService};
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class AssetController extends Controller
{
    public function index(Request $r) {
        return Asset::with(['category', 'supplier', 'location'])
            ->when($r->search, fn ($q, $s) => $q->where(fn ($w) => $w->whereLike('name', "%{$s}%")->orWhereLike('inventory_number', "%{$s}%")->orWhereLike('serial_number', "%{$s}%")))
            ->when($r->status, fn ($q, $v) => $q->where('status', $v))->when($r->condition, fn ($q, $v) => $q->where('condition', $v))
            ->when($r->location_id, fn ($q, $v) => $q->where('location_id', $v))->when($r->category_id, fn ($q, $v) => $q->where('category_id', $v))
            ->when($r->supplier_id, fn ($q, $v) => $q->where('supplier_id', $v))->latest()->paginate(min(100, max(1, $r->integer('per_page', 20))));
    }
    public function store(AssetRequest $r, AuditService $audit) {
        return DB::transaction(function () use ($r, $audit) {
            $asset = Asset::create($r->validated()); $audit->log($r, 'asset.created', $asset);
            return response()->json($asset, 201);
        });
    }
    public function show(Asset $asset) { return $asset->load(['category', 'supplier', 'location']); }
    public function update(AssetRequest $r, Asset $asset, AuditService $audit) {
        return DB::transaction(function () use ($r, $asset, $audit) {
            $asset = Asset::lockForUpdate()->findOrFail($asset->id);
            $data = $r->validated();
            foreach (['location_id', 'assigned_to'] as $key) {
                abort_if(array_key_exists($key, $data) && (string) $data[$key] !== (string) $asset->$key, 422, 'Utilisez une affectation, un transfert ou un retour pour changer la localisation.');
            }
            abort_if(isset($data['status']) && $data['status'] !== $asset->status && in_array($data['status'], ['assigned', 'maintenance'], true), 422, 'Utilisez le parcours d’affectation ou de maintenance.');
            abort_if($asset->status === 'maintenance' && ($data['status'] ?? 'maintenance') !== 'maintenance', 422, 'Clôturez les maintenances avant de changer le statut.');
            $old = $asset->getAttributes(); $asset->update($data); $audit->log($r, 'asset.updated', $asset, $old); return $asset;
        });
    }
    public function destroy(Request $r, Asset $asset, AuditService $audit) {
        return DB::transaction(function () use ($r, $asset, $audit) {
            $asset = Asset::lockForUpdate()->findOrFail($asset->id);
            abort_unless($asset->status === 'retired', 422, 'Réformez l’équipement avant de l’archiver.');
            $old = $asset->getAttributes(); $asset->delete(); $audit->log($r, 'asset.archived', $asset, $old); return response()->noContent();
        });
    }
    public function operations(Asset $asset) { return AssetOperation::with(['sourceLocation', 'destinationLocation', 'user'])->where('asset_id', $asset->id)->latest()->paginate(20); }
    public function operate(Request $r, Asset $asset, AssetService $service) {
        $data = $r->validate(['type' => ['required', Rule::in(['assignment', 'transfer', 'return'])], 'destination_location_id' => ['required', 'exists:locations,id'], 'assigned_to' => ['required_if:type,assignment', 'nullable', 'string', 'max:255'], 'reason' => ['required', 'string', 'max:255'], 'notes' => ['nullable', 'string', 'max:5000']]);
        return response()->json($service->operate($r, $asset, $data), 201);
    }
    public function maintenances(Asset $asset) { return $asset->maintenances()->latest()->paginate(20); }
    public function history(Asset $asset) {
        return AuditLog::where(fn ($q) => $q->where('auditable_type', Asset::class)->where('auditable_id', $asset->id))
            ->orWhere(fn ($q) => $q->where('auditable_type', AssetMaintenance::class)->whereIn('auditable_id', $asset->maintenances()->select('id')))
            ->latest('id')->paginate(20);
    }
    public function storeMaintenance(Request $r, Asset $asset, AssetService $service) {
        return response()->json($service->maintenance($r, $asset, $r->validate($this->maintenanceRules())), 201);
    }
    public function updateMaintenance(Request $r, Asset $asset, AssetMaintenance $maintenance, AssetService $service) {
        return $service->maintenance($r, $asset, $r->validate($this->maintenanceRules()), $maintenance);
    }
    private function maintenanceRules(): array {
        return ['performed_at' => ['required', 'date_format:Y-m-d'], 'type' => ['required', 'string', 'max:100'], 'description' => ['required', 'string', 'max:5000'], 'provider' => ['nullable', 'string', 'max:255'], 'cost' => ['nullable', 'numeric', 'decimal:0,2', 'min:0', 'max:999999999999.99'], 'status' => ['required', Rule::in(['scheduled', 'in_progress', 'completed', 'cancelled'])], 'notes' => ['nullable', 'string', 'max:5000']];
    }
}
