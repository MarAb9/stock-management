<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\AssetController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\InventoryController;
use App\Http\Controllers\Api\ProductController;
use App\Http\Controllers\Api\ReportController;
use App\Http\Controllers\Api\SettingsController;
use App\Http\Controllers\Api\StockMovementController;

Route::middleware('web')->group(function () {
Route::post('auth/login', [AuthController::class, 'login'])->middleware('throttle:5,1');

Route::middleware('auth:sanctum')->group(function (): void {
    Route::get('auth/me', [AuthController::class, 'me']);
    Route::get('institution', [\App\Http\Controllers\Api\InstitutionController::class, 'show']);
    Route::patch('institution', [\App\Http\Controllers\Api\InstitutionController::class, 'update']);
    Route::post('institution/logo', [\App\Http\Controllers\Api\InstitutionController::class, 'logo']);
    Route::get('audit', [\App\Http\Controllers\Api\InstitutionController::class, 'audit']);
    Route::get('attachments/{type}/{id}', [\App\Http\Controllers\Api\AttachmentController::class, 'index']);
    Route::post('attachments/{type}/{id}', [\App\Http\Controllers\Api\AttachmentController::class, 'store']);
    Route::get('attachments/{attachment}/download', [\App\Http\Controllers\Api\AttachmentController::class, 'download']);
    Route::get('settings/{type}/{id}', [SettingsController::class, 'show']);
    Route::post('auth/logout', [AuthController::class, 'logout']);
    Route::post('auth/password', [AuthController::class, 'password'])->middleware('throttle:5,1');
    Route::get('products/{product}/lots', [ProductController::class, 'lots']);
    Route::get('products/{product}/balances', [ProductController::class, 'balances']);
    Route::get('assets/{asset}/operations', [AssetController::class, 'operations']);
    Route::post('assets/{asset}/operations', [AssetController::class, 'operate']);
    Route::get('assets/{asset}/history', [AssetController::class, 'history']);
    Route::get('assets/{asset}/maintenances', [AssetController::class, 'maintenances']);
    Route::patch('assets/{asset}/maintenances/{maintenance}', [AssetController::class, 'updateMaintenance']);
    Route::get('inventory-sessions/{inventorySession}/lines', [InventoryController::class, 'lines']);
    Route::post('inventory-sessions/{inventorySession}/lines', [InventoryController::class, 'addLine']);
    Route::post('inventory-sessions/{inventorySession}/cancel', [InventoryController::class, 'cancel']);
    Route::get('dashboard', DashboardController::class);
    Route::apiResource('products', ProductController::class);
    Route::get('stock/movements', [StockMovementController::class, 'index']);
    Route::post('stock/movements', [StockMovementController::class, 'store']);
    Route::get('reports/stock.pdf', [ReportController::class, 'stockPdf']);
    Route::get('reports/stock.csv', [ReportController::class, 'stockCsv']);
    Route::get('reports/{type}.{format}', [ReportController::class, 'export']);
    Route::get('reports/{type}', [ReportController::class, 'index']);
    Route::get('documents/assets/{operation}.pdf', [ReportController::class, 'assetPdf']);
    Route::get('labels/{type}/{id}.pdf', [ReportController::class, 'label']);
    Route::get('documents/movements/{movement}.pdf', [ReportController::class, 'movementPdf']);
    Route::get('documents/inventories/{inventorySession}.pdf', [ReportController::class, 'inventoryPdf']);
    Route::apiResource('assets', AssetController::class);
    Route::post('assets/{asset}/maintenances', [AssetController::class, 'storeMaintenance']);
    Route::apiResource('inventory-sessions', InventoryController::class)->only(['index', 'store', 'show']);
    Route::patch('inventory-sessions/{inventorySession}/lines/{line}', [InventoryController::class, 'updateLine']);
    Route::post('inventory-sessions/{inventorySession}/validate', [InventoryController::class, 'validateSession']);
    Route::get('settings/{type}', [SettingsController::class, 'index']);
    Route::post('settings/{type}', [SettingsController::class, 'store']);
    Route::patch('settings/{type}/{id}', [SettingsController::class, 'update']);
    Route::delete('settings/{type}/{id}', [SettingsController::class, 'destroy']);
});
});
