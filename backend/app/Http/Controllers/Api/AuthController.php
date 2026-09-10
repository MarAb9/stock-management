<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\AuditService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\{Auth, DB, Hash};
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function login(Request $request, AuditService $audit)
    {
        $data = $request->validate(['email' => ['required', 'email', 'max:255'], 'password' => ['required', 'string', 'max:255']]);
        if (! Auth::attempt($data)) {
            throw ValidationException::withMessages(['email' => 'Identifiants invalides.']);
        }
        $request->session()->regenerate();
        $audit->log($request, 'login', $request->user());
        return ['user' => $request->user()];
    }
    public function me(Request $request) { return $request->user(); }
    public function logout(Request $request, AuditService $audit)
    {
        $audit->log($request, 'logout', $request->user());
        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();
        return response()->noContent();
    }
    public function password(Request $request, AuditService $audit)
    {
        $data = $request->validate(['current_password' => ['required', 'current_password:web'], 'password' => ['required', 'string', 'min:12', 'max:255', 'confirmed']]);
        DB::transaction(function () use ($request, $data, $audit) {
            $request->user()->update(['password' => Hash::make($data['password'])]);
            $request->user()->tokens()->delete();
            if (config('session.driver') === 'database') {
                DB::table('sessions')->where('user_id', $request->user()->id)->where('id', '!=', $request->session()->getId())->delete();
            }
            $audit->log($request, 'password.changed', $request->user());
        });
        $request->session()->regenerate();
        return response()->noContent();
    }
}
