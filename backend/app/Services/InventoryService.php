<?php

namespace App\Services;

use App\Models\{InventoryLine, InventorySession, Product, StockBalance, StockMovement};
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class InventoryService
{
    public function create(array $data, Request $request): InventorySession
    {
        return DB::transaction(function () use ($data, $request) {
            // Consistent snapshot with the same product locks used by stock operations.
            Product::orderBy('id')->lockForUpdate()->get(['id']);
            $session = InventorySession::create($data + ['status' => 'in_progress', 'started_at' => today(), 'last_movement_id' => StockMovement::max('id') ?? 0]);
            StockBalance::when($data['location_id'] ?? null, fn ($q, $id) => $q->where('location_id', $id))->orderBy('id')->get()->each(fn ($b) => $session->lines()->create([
                'product_id' => $b->product_id, 'location_id' => $b->location_id, 'stock_lot_id' => $b->stock_lot_id, 'theoretical_quantity' => $b->quantity,
            ]));
            app(AuditService::class)->log($request, 'inventory.created', $session);
            return $session;
        }, 3);
    }

    public function count(Request $request, InventorySession $session, InventoryLine $line): InventoryLine
    {
        $data = $request->validate(['physical_quantity' => ['required', 'numeric', 'decimal:0,3', 'min:0', 'max:99999999999.999'], 'reason' => ['nullable', 'string', 'max:255'], 'comment' => ['nullable', 'string', 'max:5000']]);
        return DB::transaction(function () use ($data, $session, $line) {
            $session = InventorySession::lockForUpdate()->findOrFail($session->id);
            abort_unless($session->status === 'in_progress' && $line->inventory_session_id === $session->id, 422, 'Ce comptage ne peut plus être modifié.');
            $variance = bcsub((string) $data['physical_quantity'], $line->theoretical_quantity, 3);
            if (bccomp($variance, '0', 3) !== 0 && empty($data['reason'])) {
                throw ValidationException::withMessages(['reason' => 'Un motif est obligatoire pour justifier un écart.']);
            }
            $line->update($data + ['variance' => $variance]);
            return $line;
        });
    }

    public function validate(Request $request, InventorySession $session): InventorySession
    {
        return DB::transaction(function () use ($request, $session) {
            $session = InventorySession::lockForUpdate()->findOrFail($session->id);
            if ($session->status !== 'in_progress') {
                throw ValidationException::withMessages(['session' => 'Cette session ne peut plus être validée.']);
            }
            $lines = $session->lines()->orderBy('product_id')->orderBy('id')->get();
            if ($lines->isEmpty() || $lines->contains(fn ($line) => $line->physical_quantity === null)) {
                throw ValidationException::withMessages(['physical_quantity' => 'Chaque ligne doit être comptée avant validation. Un inventaire vide ne peut pas être validé.']);
            }
            Product::whereIn('id', $lines->pluck('product_id'))->orderBy('id')->lockForUpdate()->get();
            foreach ($lines as $line) {
                $changed = StockMovement::where('product_id', $line->product_id)->where('stock_lot_id', $line->stock_lot_id)->where('id', '>', $session->last_movement_id)
                    ->where(fn ($q) => $q->where('source_location_id', $line->location_id)->orWhere('destination_location_id', $line->location_id))->exists();
                if ($changed) {
                    throw ValidationException::withMessages(['session' => 'Le stock a bougé depuis l’ouverture. Annulez cette session et recommencez le comptage.']);
                }
                if (bccomp($line->variance, '0', 3) !== 0) {
                    $increase = bccomp($line->variance, '0', 3) > 0;
                    $movement = app(StockService::class)->record([
                        'product_id' => $line->product_id, 'stock_lot_id' => $line->stock_lot_id, 'type' => 'adjustment',
                        'direction' => $increase ? 'increase' : 'decrease', 'quantity' => ltrim($line->variance, '-'),
                        $increase ? 'destination_location_id' : 'source_location_id' => $line->location_id,
                        'reason' => 'Inventaire #'.$session->id.' : '.$line->reason, 'notes' => $line->comment,
                    ], $request->user());
                    $line->update(['adjustment_id' => $movement->id]);
                }
            }
            $session->update(['status' => 'validated', 'validated_at' => now(), 'validated_by' => $request->user()->id]);
            app(AuditService::class)->log($request, 'inventory.validated', $session);
            return $session;
        }, 3);
    }
}
