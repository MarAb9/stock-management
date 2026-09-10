<?php

namespace App\Services;

use App\Models\{Asset, AssetMaintenance, AssetOperation};
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class AssetService
{
    public function operate(Request $request, Asset $asset, array $data): AssetOperation
    {
        return DB::transaction(function () use ($request, $asset, $data) {
            $asset = Asset::lockForUpdate()->findOrFail($asset->id);
            if (in_array($asset->status, ['retired', 'maintenance', 'out_of_service'], true)) {
                throw ValidationException::withMessages(['asset' => 'Cet équipement doit être disponible ou affecté pour cette opération.']);
            }
            $type = $data['type'];
            $destination = $data['destination_location_id'];
            if ($type === 'transfer' && (int) $asset->location_id === (int) $destination) {
                throw ValidationException::withMessages(['destination_location_id' => 'Choisissez un emplacement différent.']);
            }
            if ($type === 'return' && $asset->status !== 'assigned') {
                throw ValidationException::withMessages(['type' => 'Seul un équipement affecté peut être retourné.']);
            }
            $old = $asset->getAttributes();
            $asset->update(['location_id' => $destination, 'assigned_to' => $type === 'return' ? null : ($data['assigned_to'] ?? $asset->assigned_to), 'status' => $type === 'assignment' ? 'assigned' : ($type === 'return' ? 'available' : $asset->status)]);
            $operation = AssetOperation::create([
                'reference' => 'EQP-'.Str::ulid(), 'asset_id' => $asset->id, 'type' => $type,
                'source_location_id' => $old['location_id'], 'destination_location_id' => $destination,
                'assigned_to' => $asset->assigned_to, 'reason' => $data['reason'], 'notes' => $data['notes'] ?? null,
                'snapshot' => $asset->toArray(), 'user_id' => $request->user()->id,
            ]);
            app(AuditService::class)->log($request, 'asset.'.$type, $asset, $old);
            return $operation;
        }, 3);
    }
    public function maintenance(Request $request, Asset $asset, array $data, ?AssetMaintenance $maintenance = null): AssetMaintenance
    {
        return DB::transaction(function () use ($request, $asset, $data, $maintenance) {
            $asset = Asset::lockForUpdate()->findOrFail($asset->id);
            abort_if($asset->status === 'retired', 422, 'Équipement réformé.');
            if ($maintenance) {
                abort_unless($maintenance->asset_id === $asset->id, 404);
                abort_if(in_array($maintenance->status, ['completed', 'cancelled'], true), 422, 'Cette intervention est clôturée.');
                $old = $maintenance->getAttributes();
                $maintenance->update($data);
            } else {
                $old = null;
                $maintenance = $asset->maintenances()->create($data);
            }
            $active = $asset->maintenances()->whereIn('status', ['scheduled', 'in_progress'])->exists();
            $asset->update(['status' => $active ? 'maintenance' : ($asset->assigned_to ? 'assigned' : 'available')]);
            app(AuditService::class)->log($request, 'asset.maintenance', $maintenance, $old);
            return $maintenance;
        }, 3);
    }
}
