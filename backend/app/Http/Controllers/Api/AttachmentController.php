<?php
namespace App\Http\Controllers\Api;
use App\Http\Controllers\Controller;
use App\Models\{Attachment, Product, Asset, StockMovement, InventorySession, AssetMaintenance, InstitutionSetting};
use App\Services\AuditService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\{DB, Storage};
use Illuminate\Validation\Rules\File;

class AttachmentController extends Controller {
    private const MODELS = ['products' => Product::class, 'assets' => Asset::class, 'movements' => StockMovement::class, 'inventories' => InventorySession::class, 'maintenances' => AssetMaintenance::class];
    private function entity(string $type, int $id) {
        abort_unless(isset(self::MODELS[$type]), 404);
        return self::MODELS[$type]::findOrFail($id);
    }
    public function index(string $type, int $id) {
        $this->entity($type, $id);
        return Attachment::where('entity_type', $type)->where('entity_id', $id)->latest()->paginate(20);
    }
    public function store(Request $r, string $type, int $id, AuditService $audit) {
        $this->entity($type, $id);
        $r->validate(['file' => ['required', File::types(['pdf', 'jpg', 'jpeg', 'png'])->max(10240), 'extensions:pdf,jpg,jpeg,png']]);
        $file = $r->file('file');
        if (str_starts_with($file->getMimeType(), 'image/')) {
            $r->validate(['file' => ['image', 'dimensions:max_width=6000,max_height=6000']]);
        }
        $path = $file->store('attachments', 'local');
        abort_unless($path, 500, 'Le fichier n’a pas pu être enregistré.');
        try {
            return DB::transaction(function () use ($r, $type, $id, $audit, $file, $path) {
                $attachment = Attachment::create(['entity_type' => $type, 'entity_id' => $id, 'name' => mb_substr(basename(str_replace('\\', '/', $file->getClientOriginalName())), 0, 200), 'path' => $path, 'mime' => $file->getMimeType(), 'size' => $file->getSize(), 'user_id' => $r->user()->id]);
                $audit->log($r, 'attachment.created', $attachment);
                return response()->json($attachment, 201);
            });
        } catch (\Throwable $e) { Storage::disk('local')->delete($path); throw $e; }
    }
    public function download(Attachment $attachment) {
        abort_unless(Storage::disk('local')->exists($attachment->getRawOriginal('path')), 404);
        return Storage::disk('local')->download($attachment->getRawOriginal('path'), $attachment->name, ['Content-Type' => $attachment->mime, 'Cache-Control' => 'private, no-store']);
    }
}
