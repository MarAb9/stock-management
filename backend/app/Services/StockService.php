<?php

namespace App\Services;

use App\Http\Requests\StoreMovementRequest;
use App\Models\{Product, StockBalance, StockLot, StockMovement, User};
use Illuminate\Support\Facades\{DB, Validator};
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class StockService
{
    public function record(array $data, User $user): StockMovement
    {
        $data = Validator::make($data, (new StoreMovementRequest)->rules())->validate();
        return DB::transaction(function () use ($data, $user): StockMovement {
            $product = Product::query()->lockForUpdate()->findOrFail($data['product_id']);
            if (! $product->active) {
                throw ValidationException::withMessages(['product_id' => 'Ce produit est inactif.']);
            }
            $type = $data['type'];
            $decrease = in_array($type, ['exit', 'loss', 'disposal', 'transfer'], true) || ($type === 'adjustment' && $data['direction'] === 'decrease');
            $source = $decrease ? ($data['source_location_id'] ?? null) : null;
            $destination = (! $decrease || $type === 'transfer') ? ($data['destination_location_id'] ?? null) : null;
            if (($decrease && ! $source) || ((! $decrease || $type === 'transfer') && ! $destination)) {
                throw ValidationException::withMessages(['location' => 'Renseignez les emplacements nécessaires à cette opération.']);
            }
            if ($type === 'transfer' && (int) $source === (int) $destination) {
                throw ValidationException::withMessages(['destination_location_id' => 'L’emplacement source et l’emplacement destination doivent être différents.']);
            }
            $quantity = bcadd((string) $data['quantity'], '0', 3);
            $lot = null;
            if (! empty($data['stock_lot_id'])) {
                $lot = StockLot::where('product_id', $product->id)->find($data['stock_lot_id']);
                if (! $product->track_lots || ! $lot) {
                    throw ValidationException::withMessages(['stock_lot_id' => 'Le lot doit appartenir à ce produit géré par lots.']);
                }
            } elseif ($product->track_lots && $type === 'entry') {
                if (empty($data['lot_number'])) {
                    throw ValidationException::withMessages(['lot_number' => 'Le numéro de lot est obligatoire.']);
                }
                if ($product->lots()->where('lot_number', $data['lot_number'])->exists()) {
                    throw ValidationException::withMessages(['lot_number' => 'Ce lot existe déjà. Sélectionnez le lot existant.']);
                }
                $lot = $product->lots()->create([
                    'supplier_id' => $data['supplier_id'] ?? $product->supplier_id,
                    'lot_number' => $data['lot_number'], 'received_at' => $data['performed_at'] ?? today(),
                    'produced_at' => $data['produced_at'] ?? null, 'expires_at' => $data['expires_at'] ?? null,
                    'purchase_price' => $data['purchase_price'] ?? $product->purchase_price,
                ]);
            }
            $allowExpired = in_array($type, ['loss', 'disposal', 'adjustment'], true);
            if ($lot && ! $allowExpired && $lot->expires_at?->lt(today())) {
                throw ValidationException::withMessages(['stock_lot_id' => 'Ce lot est expiré et ne peut pas être utilisé pour cette opération.']);
            }
            $allocations = [];
            if ($product->track_lots && ! $lot) {
                if (! $decrease) {
                    throw ValidationException::withMessages(['stock_lot_id' => 'Sélectionnez un lot pour ce retour ou cet ajustement.']);
                }
                $remaining = $quantity;
                $balances = StockBalance::where('stock_balances.product_id', $product->id)
                    ->where('location_id', $source)->where('quantity', '>', 0)
                    ->join('stock_lots', 'stock_lots.id', '=', 'stock_balances.stock_lot_id')
                    ->when(! $allowExpired, fn ($q) => $q->where(fn ($w) => $w->whereNull('expires_at')->orWhereDate('expires_at', '>=', today())))
                    ->orderByRaw('stock_lots.expires_at IS NULL')->orderBy('stock_lots.expires_at')->orderBy('stock_lots.id')
                    ->get(['stock_balances.quantity', 'stock_balances.stock_lot_id']);
                foreach ($balances as $balance) {
                    $take = bccomp($balance->quantity, $remaining, 3) < 0 ? $balance->quantity : $remaining;
                    $allocations[] = [$balance->stock_lot_id, $take];
                    $remaining = bcsub($remaining, $take, 3);
                    if (bccomp($remaining, '0', 3) === 0) { break; }
                }
                if (bccomp($remaining, '0', 3) > 0) {
                    throw ValidationException::withMessages(['quantity' => 'Stock insuffisant dans les lots admissibles pour effectuer cette sortie.']);
                }
            } else {
                $allocations[] = [$lot?->id, $quantity];
            }
            $operation = (string) Str::ulid();
            $first = null;
            foreach ($allocations as [$lotId, $amount]) {
                if ($source) { $this->change($product->id, $source, $lotId, bcsub('0', $amount, 3)); }
                if ($destination) { $this->change($product->id, $destination, $lotId, $amount); }
                $movement = StockMovement::create([
                    'reference' => 'MVT-'.Str::ulid(), 'operation_reference' => $operation,
                    'product_id' => $product->id, 'stock_lot_id' => $lotId, 'type' => $type,
                    'direction' => $type === 'adjustment' ? $data['direction'] : null, 'quantity' => $amount,
                    'source_location_id' => $source, 'destination_location_id' => $destination,
                    'user_id' => $user->id, 'reason' => $data['reason'] ?? null, 'notes' => $data['notes'] ?? null,
                    'performed_at' => $data['performed_at'] ?? now(),
                ]);
                app(AuditService::class)->log(request(), 'stock.'.$type, $movement, user: $user);
                $first ??= $movement;
            }
            return $first;
        }, 3);
    }

    private function change(int $productId, int $locationId, ?int $lotId, string $delta): void
    {
        $balance = StockBalance::firstOrCreate(['product_id' => $productId, 'location_id' => $locationId, 'stock_lot_id' => $lotId], ['quantity' => 0]);
        $quantity = bcadd($balance->quantity, $delta, 3);
        if (bccomp($quantity, '0', 3) < 0) {
            throw ValidationException::withMessages(['quantity' => 'Stock insuffisant pour effectuer cette sortie.']);
        }
        if (bccomp($quantity, '99999999999.999', 3) > 0) {
            throw ValidationException::withMessages(['quantity' => 'La capacité maximale de stockage est dépassée.']);
        }
        $balance->update(['quantity' => $quantity]);
    }
}
