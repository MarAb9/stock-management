<?php

namespace App\Services;

use App\Models\{AuditLog, User};
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;

class AuditService
{
    public function log(Request $request, string $action, Model $model, ?array $old = null, ?User $user = null): void
    {
        $hidden = array_merge($model->getHidden(), ['password', 'remember_token', 'token', 'path']);
        AuditLog::create([
            'user_id' => $user?->id ?? $request->user()?->id,
            'action' => $action, 'auditable_type' => $model::class, 'auditable_id' => $model->getKey(),
            'old_values' => $old === null ? null : Arr::except($old, $hidden),
            'new_values' => Arr::except($model->getAttributes(), $hidden),
            'ip_address' => $request->ip(), 'occurred_at' => now(),
        ]);
    }
}
