<?php
namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\{Asset, AssetOperation, InstitutionSetting, InventorySession, InventoryLine, Product, StockBalance, StockLot, StockMovement};
use Barryvdh\DomPDF\Facade\Pdf;
use Endroid\QrCode\{QrCode, Writer\PngWriter};
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class ReportController extends Controller {
    public const LABELS = ['entry' => 'Entrée', 'exit' => 'Sortie', 'return' => 'Retour', 'transfer' => 'Transfert', 'adjustment' => 'Ajustement', 'loss' => 'Perte', 'disposal' => 'Mise au rebut', 'assignment' => 'Affectation', 'available' => 'Disponible', 'assigned' => 'Affecté', 'maintenance' => 'En maintenance', 'out_of_service' => 'Hors service', 'retired' => 'Réformé', 'new' => 'Neuf', 'very_good' => 'Très bon', 'good' => 'Bon', 'fair' => 'Moyen', 'repair' => 'À réparer', 'in_progress' => 'En cours', 'validated' => 'Validé', 'cancelled' => 'Annulé'];
    public function index(Request $r, string $type) {
        [$title, $columns, $query, $row] = $this->definition($r, $type);
        $page = $query->paginate(30);
        $page->setCollection($page->getCollection()->map($row));
        return ['title' => $title, 'columns' => $columns, 'rows' => $page];
    }
    public function export(Request $r, string $type, string $format) {
        abort_unless(in_array($format, ['pdf', 'csv'], true), 404);
        [$title, $columns, $query, $row] = $this->definition($r, $type);
        if ($format === 'csv') {
            return response()->streamDownload(function () use ($query, $columns, $row) {
                $out = fopen('php://output', 'w'); fwrite($out, "\xEF\xBB\xBF");
                fputcsv($out, $columns, ';', '"', '');
                foreach ($query->cursor() as $item) {
                    fputcsv($out, array_map(fn ($v) => is_string($v) && preg_match('/^[\\s]*[=+@-]/u', $v) ? "'".$v : $v, $row($item)), ';', '"', '');
                }
                fclose($out);
            }, $type.'.csv', ['Content-Type' => 'text/csv; charset=UTF-8']);
        }
        // ponytail: synchronous PDF limited to 2000 rows; add queued exports if larger PDFs are required.
        $items = $query->limit(2001)->get();
        abort_if($items->count() > 2000, 422, 'Limitez les filtres à 2 000 lignes pour le PDF ou utilisez le CSV.');
        return $this->pdf($title, $columns, $items->map($row)->all(), $type.'-'.now()->format('Ymd'), $r);
    }
    public function stockPdf(Request $r) { return $this->export($r, 'stock', 'pdf'); }
    public function stockCsv(Request $r) { return $this->export($r, 'stock', 'csv'); }
    public function movementPdf(Request $r, StockMovement $movement) {
        $rows = StockMovement::with(['product.unit', 'sourceLocation', 'destinationLocation', 'lot'])
            ->when($movement->operation_reference, fn ($q, $ref) => $q->where('operation_reference', $ref), fn ($q) => $q->whereKey($movement->id))->get()
            ->map(fn ($m) => [$m->product->reference.' — '.$m->product->name, $m->lot?->lot_number ?? '—', $m->quantity, $m->product->unit?->symbol, $m->sourceLocation?->name ?? '—', $m->destinationLocation?->name ?? '—'])->all();
        return $this->pdf('Bon de '.mb_strtolower(self::LABELS[$movement->type]), ['Article', 'Lot', 'Quantité', 'Unité', 'Source', 'Destination'], $rows, $movement->reference, $r,
            $movement->reason.' — '.$movement->notes, $movement->performed_at->format('d/m/Y H:i'), $movement->user->name);
    }
    public function inventoryPdf(Request $r, InventorySession $inventorySession) {
        $rows = $inventorySession->lines()->with(['product', 'location', 'lot'])->get()->map(fn ($l) => [$l->product->name, $l->location?->name, $l->lot?->lot_number, $l->theoretical_quantity, $l->physical_quantity, $l->variance, $l->reason])->all();
        return $this->pdf('Procès-verbal d’inventaire — '.$inventorySession->name, ['Article', 'Emplacement', 'Lot', 'Théorique', 'Physique', 'Écart', 'Motif'], $rows, 'INV-'.$inventorySession->id, $r, 'Statut : '.(self::LABELS[$inventorySession->status] ?? $inventorySession->status));
    }
    public function assetPdf(Request $r, AssetOperation $operation) {
        $a = $operation->snapshot;
        return $this->pdf('Bon de '.mb_strtolower(self::LABELS[$operation->type]), ['N° inventaire', 'Équipement', 'Source', 'Destination', 'Affectation'],
            [[$a['inventory_number'], $a['name'], $operation->sourceLocation?->name, $operation->destinationLocation?->name, $operation->assigned_to]],
            $operation->reference, $r, $operation->reason.' — '.$operation->notes, $operation->created_at->format('d/m/Y H:i'), $operation->user->name);
    }
    public function label(Request $r, string $type, int $id) {
        abort_unless(in_array($type, ['products', 'assets'], true), 404);
        $model = ($type === 'products' ? Product::class : Asset::class)::findOrFail($id);
        $path = $type === 'products' ? 'produits' : 'equipements';
        $url = rtrim(config('app.frontend_url'), '/').'/'.$path.'/'.$id;
        $qr = (new PngWriter)->write(new QrCode(data: $url, size: 220))->getDataUri();
        return Pdf::loadView('pdf.label', ['item' => $model, 'qr' => $qr, 'url' => $url, 'institution' => InstitutionSetting::findOrFail(1)])->download('etiquette-'.$id.'.pdf');
    }
    private function pdf(string $title, array $columns, array $rows, string $reference, Request $r, ?string $notes = null, ?string $date = null, ?string $author = null) {
        $institution = InstitutionSetting::findOrFail(1); $logo = null;
        if ($institution->logo_path && Storage::disk('local')->exists($institution->logo_path)) {
            $logo = 'data:'.Storage::disk('local')->mimeType($institution->logo_path).';base64,'.base64_encode(Storage::disk('local')->get($institution->logo_path));
        }
        return Pdf::loadView('pdf.report', compact('title', 'columns', 'rows', 'reference', 'notes', 'institution', 'logo') + ['date' => $date ?? now()->format('d/m/Y H:i'), 'author' => $author ?? $r->user()->name])->setPaper('a4', count($columns) > 6 ? 'landscape' : 'portrait')->download($reference.'.pdf');
    }
    private function definition(Request $r, string $type): array {
        $r->validate(['from' => ['nullable', 'date_format:Y-m-d'], 'to' => ['nullable', 'date_format:Y-m-d'], 'year' => ['nullable', 'integer', 'between:1900,2200']]);
        $label = fn ($v) => self::LABELS[$v] ?? $v;
        $asset = Asset::with(['category', 'location'])->when($r->category_id, fn ($q, $v) => $q->where('category_id', $v))->when($r->location_id, fn ($q, $v) => $q->where('location_id', $v))->when($r->status, fn ($q, $v) => $q->where('status', $v))->when($r->condition, fn ($q, $v) => $q->where('condition', $v))->when($r->year, fn ($q, $v) => $q->whereYear('acquired_at', $v));
        $movements = StockMovement::with(['product', 'lot', 'sourceLocation', 'destinationLocation'])
            ->when($r->from, fn ($q, $v) => $q->whereDate('performed_at', '>=', $v))->when($r->to, fn ($q, $v) => $q->whereDate('performed_at', '<=', $v))
            ->when($r->movement_type, fn ($q, $v) => $q->where('type', $v))->when($r->product_id, fn ($q, $v) => $q->where('product_id', $v))
            ->when($r->supplier_id, fn ($q, $v) => $q->where(fn ($w) => $w->whereHas('lot', fn ($l) => $l->where('supplier_id', $v))->orWhereHas('product', fn ($p) => $p->where('supplier_id', $v))))
            ->when($r->location_id, fn ($q, $v) => $q->where(fn ($w) => $w->where('source_location_id', $v)->orWhere('destination_location_id', $v)));
        if ($type === 'consumption') {
            $query = clone $movements;
            $query->where('type', 'exit')->selectRaw('product_id, sum(quantity) as total')->groupBy('product_id')->orderBy('product_id');
            return ['Consommation par période', ['Produit', 'Unité', 'Quantité sortie'], $query->with('product.unit'), fn ($m) => [$m->product?->name, $m->product?->unit?->symbol, $m->total]];
        }
        $stock = Product::with('unit')->withSum('balances as stock_quantity', 'quantity')
            ->when($r->category_id, fn ($q, $v) => $q->where('category_id', $v))->when($r->supplier_id, fn ($q, $v) => $q->where('supplier_id', $v))
            ->when($r->stock === 'out', fn ($q) => $q->whereDoesntHave('balances', fn ($b) => $b->where('quantity', '>', 0)))
            ->when($r->stock === 'low', fn ($q) => $q->whereRaw('(SELECT COALESCE(SUM(quantity), 0) FROM stock_balances WHERE product_id = products.id) <= minimum_stock'));
        return match ($type) {
            'stock' => ['État et valeur du stock', ['Référence', 'Désignation', 'Unité', 'Stock', 'Seuil', 'Prix MAD', 'Valeur MAD'], $stock->orderBy('name'), fn ($p) => [$p->reference, $p->name, $p->unit?->symbol, $p->stock_quantity ?? '0', $p->minimum_stock, $p->purchase_price, $p->purchase_price === null ? 'Non renseigné' : bcmul($p->stock_quantity ?? '0', $p->purchase_price, 2)]],
            'assets' => ['État des équipements', ['N° inventaire', 'Désignation', 'Catégorie', 'Emplacement', 'État', 'Statut', 'Acquisition', 'Valeur MAD'], $asset->orderBy('inventory_number'), fn ($a) => [$a->inventory_number, $a->name, $a->category?->name, $a->location?->name, $label($a->condition), $label($a->status), $a->acquired_at?->format('d/m/Y'), $a->acquisition_price]],
            'movements' => ['Historique des mouvements', ['Référence', 'Date', 'Article', 'Lot', 'Type', 'Quantité', 'Source', 'Destination', 'Motif'], $movements->latest('performed_at'), fn ($m) => [$m->reference, $m->performed_at->format('d/m/Y H:i'), $m->product?->name, $m->lot?->lot_number, $label($m->type), $m->quantity, $m->sourceLocation?->name, $m->destinationLocation?->name, $m->reason]],
            'lots' => ['Lots et péremptions', ['Produit', 'Lot', 'Expiration', 'Quantité', 'État'], StockLot::with('product')->withSum('balances as quantity', 'quantity')->whereHas('balances', fn ($q) => $q->where('quantity', '>', 0))->when($r->expiry === 'expired', fn ($q) => $q->whereDate('expires_at', '<', today()))->when($r->expiry === 'soon', fn ($q) => $q->whereBetween('expires_at', [today(), today()->addDays(30)]))->orderBy('expires_at'), fn ($l) => [$l->product?->name, $l->lot_number, $l->expires_at?->format('d/m/Y'), $l->quantity, $l->expires_at?->lt(today()) ? 'Expiré' : ($l->expires_at?->lte(today()->addDays(30)) ? 'Expire bientôt' : 'Valide')]],
            'inventory' => ['Écarts d’inventaire', ['Session', 'Article', 'Emplacement', 'Lot', 'Théorique', 'Physique', 'Écart', 'Motif', 'Ajustement'], InventoryLine::with(['product', 'location', 'lot'])->when($r->session_id, fn ($q, $v) => $q->where('inventory_session_id', $v))->when($r->boolean('variance'), fn ($q) => $q->where('variance', '<>', 0))->orderByDesc('id'), fn ($l) => [$l->inventory_session_id, $l->product?->name, $l->location?->name, $l->lot?->lot_number, $l->theoretical_quantity, $l->physical_quantity, $l->variance, $l->reason, $l->adjustment_id]],
            default => abort(404),
        };
    }
}
