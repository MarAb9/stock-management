<?php

namespace Tests\Feature;

use App\Models\Asset;
use App\Models\AssetOperation;
use App\Models\AuditLog;
use App\Models\Location;
use App\Models\User;
use App\Services\AssetService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Tests\TestCase;

class AssetServiceTest extends TestCase
{
    use RefreshDatabase;

    public function test_operations_update_asset_and_keep_traceable_history(): void
    {
        [$user, $asset, $store, $office] = $this->context();
        $service = app(AssetService::class);

        $assignment = $service->operate($this->request($user), $asset, [
            'type' => 'assignment',
            'destination_location_id' => $office->id,
            'assigned_to' => 'Laboratoire',
            'reason' => 'Mise a disposition',
        ]);

        $this->assertSame('assigned', $asset->fresh()->status);
        $this->assertSame('Laboratoire', $asset->fresh()->assigned_to);
        $this->assertSame($store->id, $assignment->source_location_id);
        $this->assertSame($office->id, $assignment->destination_location_id);
        $this->assertSame('Laboratoire', $assignment->assigned_to);
        $this->assertSame($office->id, $assignment->snapshot['location_id']);
        $this->assertDatabaseHas('audit_logs', ['action' => 'asset.assignment', 'auditable_id' => $asset->id, 'user_id' => $user->id]);

        $return = $service->operate($this->request($user), $asset, [
            'type' => 'return',
            'destination_location_id' => $store->id,
            'reason' => 'Retour stock',
        ]);

        $this->assertSame('available', $asset->fresh()->status);
        $this->assertNull($asset->fresh()->assigned_to);
        $this->assertSame($office->id, $return->source_location_id);
        $this->assertSame(2, AssetOperation::where('asset_id', $asset->id)->count());
    }

    public function test_operations_reject_unavailable_assets_and_invalid_returns_without_history(): void
    {
        [$user, $asset, $store, $office] = $this->context();
        $service = app(AssetService::class);

        try {
            $service->operate($this->request($user), $asset, [
                'type' => 'return',
                'destination_location_id' => $store->id,
                'reason' => 'Retour stock',
            ]);
            $this->fail('Expected return of an unassigned asset to fail.');
        } catch (ValidationException $exception) {
            $this->assertArrayHasKey('type', $exception->errors());
        }

        $asset->update(['status' => 'maintenance']);

        try {
            $service->operate($this->request($user), $asset, [
                'type' => 'transfer',
                'destination_location_id' => $office->id,
                'reason' => 'Changement bureau',
            ]);
            $this->fail('Expected operation on unavailable asset to fail.');
        } catch (ValidationException $exception) {
            $this->assertArrayHasKey('asset', $exception->errors());
        }

        $this->assertSame($store->id, $asset->fresh()->location_id);
        $this->assertSame(0, AssetOperation::count());
        $this->assertSame(0, AuditLog::count());
    }

    public function test_maintenance_status_tracks_open_work_and_blocks_closed_or_retired_assets(): void
    {
        [$user, $asset] = $this->context();
        $service = app(AssetService::class);

        $maintenance = $service->maintenance($this->request($user), $asset, $this->maintenanceData());

        $this->assertSame('maintenance', $asset->fresh()->status);
        $this->assertSame('scheduled', $maintenance->status);
        $this->assertDatabaseHas('audit_logs', ['action' => 'asset.maintenance', 'auditable_id' => $maintenance->id, 'user_id' => $user->id]);

        $service->maintenance($this->request($user), $asset, $this->maintenanceData(['status' => 'completed']), $maintenance);

        $this->assertSame('available', $asset->fresh()->status);

        $this->expectException(HttpException::class);
        $service->maintenance($this->request($user), $asset, $this->maintenanceData(['status' => 'in_progress']), $maintenance);
    }

    public function test_maintenance_rejects_retired_assets(): void
    {
        [$user, $asset] = $this->context();
        $asset->update(['status' => 'retired']);

        $this->expectException(HttpException::class);
        app(AssetService::class)->maintenance($this->request($user), $asset, $this->maintenanceData());
    }

    /** @return array{User, Asset, Location, Location} */
    private function context(): array
    {
        $user = User::factory()->create();
        $store = Location::create(['name' => 'Magasin', 'code' => 'MAG']);
        $office = Location::create(['name' => 'Bureau', 'code' => 'BUR']);
        $asset = Asset::create([
            'inventory_number' => 'EQP-001',
            'name' => 'Microscope',
            'location_id' => $store->id,
            'condition' => 'good',
            'status' => 'available',
        ]);

        return [$user, $asset, $store, $office];
    }

    private function request(User $user): Request
    {
        $request = Request::create('/api/assets', 'POST');
        $request->setUserResolver(fn () => $user);

        return $request;
    }

    private function maintenanceData(array $overrides = []): array
    {
        return $overrides + [
            'performed_at' => '2026-09-14',
            'type' => 'preventive',
            'description' => 'Controle periodique',
            'status' => 'scheduled',
        ];
    }
}
