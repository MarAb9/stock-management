# Architecture
- Laravel 13 API + Sanctum; Angular 21 standalone SPA; PostgreSQL 16 runtime. Dependency manifests/lockfiles define actual versions.
- Flow: lazy Angular page -> shared ApiService -> `backend/routes/api.php` -> API controller/FormRequest -> Eloquent and focused business services. No repository/DTO layer or separate frontend domain store.
- `backend/bootstrap/app.php` wires routing, CORS, SecurityHeaders and JSON exception responses for API requests.
- StockService owns stock projection/movement writes; InventoryService calls StockService for variance adjustments; AssetService owns equipment operations and maintenance. AuditService records actor and before/after values within callers' transactions.
- Controllers query Eloquent directly for listings/reference data and perform some transactional mutations; service-only searches miss product/archive and inventory add/cancel rules.
- ReportController shares report definitions between paginated previews and PDF/CSV exports. Dompdf Blade documents live in `backend/resources/views/pdf/`; labels use Endroid QR codes.
- Browser uses relative API URLs through the Angular dev proxy. Docker serves the API/database; Angular runs separately.
