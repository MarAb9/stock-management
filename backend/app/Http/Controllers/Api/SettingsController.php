<?php
namespace App\Http\Controllers\Api;
use App\Http\Controllers\Controller;
use App\Models\{Category, Location, Supplier, Unit};
use App\Services\AuditService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
class SettingsController extends Controller {
    private const MODELS = ['categories' => Category::class, 'units' => Unit::class, 'suppliers' => Supplier::class, 'locations' => Location::class];
    private function model(string $type): string { abort_unless(isset(self::MODELS[$type]), 404); return self::MODELS[$type]; }
    public function index(Request $r, string $type) {
        return $this->model($type)::when($r->search, fn ($q, $s) => $q->whereLike('name', "%{$s}%"))
            ->when($r->filled('active'), fn ($q) => $q->where('active', $r->boolean('active')))
            ->orderBy('name')->paginate(min(100, max(1, $r->integer('per_page', 20))));
    }
    public function show(string $type, int $id) { return $this->model($type)::findOrFail($id); }
    public function store(Request $r, string $type, AuditService $audit) {
        return DB::transaction(function () use ($r, $type, $audit) {
            $data = $r->validate($this->rules($type)); $this->parent($type, $data);
            $record = $this->model($type)::create($data); $audit->log($r, $type.'.created', $record);
            return response()->json($record, 201);
        });
    }
    public function update(Request $r, string $type, int $id, AuditService $audit) {
        return DB::transaction(function () use ($r, $type, $id, $audit) {
            $data = $r->validate($this->rules($type, $id));
            // Lock this small reference tree to prevent concurrent parent cycles.
            if (in_array($type, ['categories', 'locations'], true)) { $this->model($type)::orderBy('id')->lockForUpdate()->get(); }
            $record = $this->model($type)::findOrFail($id); $this->parent($type, $data, $id);
            $old = $record->getAttributes(); $record->update($data); $audit->log($r, $type.'.updated', $record, $old); return $record;
        });
    }
    public function destroy(Request $r, string $type, int $id, AuditService $audit) {
        return DB::transaction(function () use ($r, $type, $id, $audit) {
            $record = $this->model($type)::findOrFail($id); $old = $record->getAttributes();
            $record->update(['active' => false]); $audit->log($r, $type.'.deactivated', $record, $old); return response()->noContent();
        });
    }
    private function parent(string $type, array $data, ?int $id = null): void {
        if (! in_array($type, ['categories', 'locations'], true)) { return; }
        $parent = $data['parent_id'] ?? null;
        $seen = $id ? [$id] : [];
        while ($parent) {
            abort_if(in_array((int) $parent, $seen, true), 422, 'Une hiérarchie ne peut pas contenir de cycle.');
            $seen[] = (int) $parent; $parent = $this->model($type)::findOrFail($parent)->parent_id;
        }
    }
    private function rules(string $type, ?int $id = null): array {
        $this->model($type);
        return match ($type) {
            'categories' => ['name' => ['required', 'string', 'max:100'], 'code' => ['required', 'string', 'max:50', Rule::unique('categories')->ignore($id)], 'parent_id' => ['nullable', 'exists:categories,id'], 'active' => ['boolean']],
            'units' => ['name' => ['required', 'string', 'max:100', Rule::unique('units')->ignore($id)], 'symbol' => ['required', 'string', 'max:16', Rule::unique('units')->ignore($id)], 'active' => ['boolean']],
            'locations' => ['name' => ['required', 'string', 'max:100'], 'code' => ['required', 'string', 'max:50', Rule::unique('locations')->ignore($id)], 'parent_id' => ['nullable', 'exists:locations,id'], 'notes' => ['nullable', 'string', 'max:5000'], 'active' => ['boolean']],
            'suppliers' => ['name' => ['required', 'string', 'max:255'], 'company' => ['nullable', 'string', 'max:255'], 'contact_name' => ['nullable', 'string', 'max:255'], 'phone' => ['nullable', 'string', 'max:40'], 'email' => ['nullable', 'email', 'max:255'], 'address' => ['nullable', 'string', 'max:2000'], 'ice' => ['nullable', 'string', 'max:64'], 'notes' => ['nullable', 'string', 'max:5000'], 'active' => ['boolean']],
        };
    }
}
