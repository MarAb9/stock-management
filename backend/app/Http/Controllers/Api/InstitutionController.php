<?php
namespace App\Http\Controllers\Api;
use App\Http\Controllers\Controller;
use App\Models\{InstitutionSetting, AuditLog};
use App\Services\AuditService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\{DB, Storage};
class InstitutionController extends Controller {
    public function show() { return InstitutionSetting::findOrFail(1); }
    public function update(Request $r, AuditService $audit) {
        $data = $r->validate(['name' => ['required', 'string', 'max:255'], 'address' => ['nullable', 'string', 'max:1000'], 'phone' => ['nullable', 'string', 'max:40'], 'email' => ['nullable', 'email', 'max:255']]);
        return DB::transaction(function () use ($r, $audit, $data) {
            $setting = InstitutionSetting::lockForUpdate()->findOrFail(1); $old = $setting->getAttributes();
            $setting->update($data); $audit->log($r, 'institution.updated', $setting, $old); return $setting;
        });
    }
    public function logo(Request $r, AuditService $audit) {
        $r->validate(['file' => ['required', 'image', 'mimes:png,jpg,jpeg', 'extensions:png,jpg,jpeg', 'max:2048', 'dimensions:max_width=2000,max_height=2000']]);
        $path = $r->file('file')->store('logos', 'local');
        abort_unless($path, 500);
        try {
            DB::transaction(function () use ($path, $r, $audit) {
                $setting = InstitutionSetting::lockForUpdate()->findOrFail(1); $old = $setting->getAttributes();
                $setting->update(['logo_path' => $path]); $audit->log($r, 'institution.logo', $setting, $old);
            });
        } catch (\Throwable $e) { Storage::disk('local')->delete($path); throw $e; }
        return response()->noContent();
    }
    public function audit(Request $r) {
        return AuditLog::with('user:id,name')->when($r->search, fn ($q, $s) => $q->whereLike('action', "%{$s}%"))
            ->when($r->from, fn ($q, $v) => $q->whereDate('occurred_at', '>=', $v))
            ->when($r->to, fn ($q, $v) => $q->whereDate('occurred_at', '<=', $v))->latest('id')->paginate(30);
    }
}
