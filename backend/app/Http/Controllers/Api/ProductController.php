<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\ProductRequest;
use App\Models\{Product, StockMovement, StockBalance};
use App\Services\AuditService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ProductController extends Controller
{
    public function index(Request $r) {
        $totals = StockBalance::selectRaw('product_id, sum(quantity) as quantity')->groupBy('product_id');
        return Product::with(['category.parent', 'unit', 'supplier'])->leftJoinSub($totals, 'totals', fn ($j) => $j->on('products.id', '=', 'totals.product_id'))
            ->select('products.*')->selectRaw('coalesce(totals.quantity, 0) as stock_quantity')
            ->when($r->search, fn ($q, $s) => $q->where(fn ($w) => $w->whereLike('products.name', "%{$s}%")->orWhereLike('reference', "%{$s}%")->orWhereLike('barcode', "%{$s}%")))
            ->when($r->category_id, fn ($q, $id) => $q->where(fn ($w) => $w->where('category_id', $id)->orWhereHas('category', fn ($c) => $c->where('parent_id', $id))))
            ->when($r->supplier_id, fn ($q, $id) => $q->where('supplier_id', $id))->when($r->filled('active'), fn ($q) => $q->where('products.active', $r->boolean('active')))
            ->when($r->stock === 'low', fn ($q) => $q->whereRaw('coalesce(totals.quantity, 0) <= minimum_stock AND coalesce(totals.quantity, 0) > 0'))
            ->when($r->stock === 'out', fn ($q) => $q->whereRaw('coalesce(totals.quantity, 0) = 0'))
            ->when($r->stock === 'available', fn ($q) => $q->whereRaw('coalesce(totals.quantity, 0) > minimum_stock'))
            ->orderBy('products.name')->paginate(min(100, max(1, $r->integer('per_page', 20))));
    }
    public function store(ProductRequest $r, AuditService $audit) {
        return DB::transaction(function () use ($r, $audit) {
            $product = Product::create($r->validated()); $audit->log($r, 'product.created', $product);
            return response()->json($product->load(['category', 'unit', 'supplier']), 201);
        });
    }
    public function show(Product $product) { return $product->load(['category.parent', 'unit', 'supplier'])->loadSum('balances as stock_quantity', 'quantity'); }
    public function lots(Product $product) { return $product->lots()->withSum('balances as quantity', 'quantity')->orderBy('expires_at')->paginate(50); }
    public function balances(Product $product) { return $product->balances()->with(['lot', 'location'])->orderBy('id')->paginate(50); }
    public function update(ProductRequest $r, Product $product, AuditService $audit) {
        return DB::transaction(function () use ($r, $product, $audit) {
            $product = Product::lockForUpdate()->findOrFail($product->id); $data = $r->validated();
            if (StockMovement::where('product_id', $product->id)->exists()) {
                foreach (['unit_id', 'track_lots'] as $field) {
                    abort_if(array_key_exists($field, $data) && (int) $data[$field] !== (int) $product->$field, 422, 'L’unité et la gestion par lots ne peuvent plus changer après un mouvement.');
                }
            }
            $old = $product->getAttributes(); $product->update($data); $audit->log($r, 'product.updated', $product, $old); return $product;
        });
    }
    public function destroy(Request $r, Product $product, AuditService $audit) {
        return DB::transaction(function () use ($r, $product, $audit) {
            $product = Product::lockForUpdate()->findOrFail($product->id);
            abort_if($product->balances()->where('quantity', '>', 0)->exists(), 422, 'Épuisez ou ajustez le stock avant d’archiver le produit.');
            $old = $product->getAttributes(); $product->delete(); $audit->log($r, 'product.archived', $product, $old);
            return response()->noContent();
        });
    }
}
