# Backend Laravel
- Start with `backend/routes/api.php`, `app/Http/Controllers/Api`, `app/Http/Requests` and named services under `app/Services`; container resolves concrete services.
- Authentication is cookie/session based: routes explicitly use web middleware; protected routes add auth:sanctum. Login uses Auth::attempt and session regeneration, returning user data, not a bearer token. Login/password endpoints are throttled.
- Logout invalidates session/CSRF token. Password change verifies current password, revokes personal tokens and other database sessions, then regenerates the current session. No role/policy authorization layer is configured.
- ProductRequest, AssetRequest and StoreMovementRequest validate writes; other controllers validate inline. StockService revalidates StoreMovementRequest rules even for direct service calls.
- API commonly returns Eloquent objects/paginators with snake_case fields. Product lists derive stock_quantity from summed balances. Reports return title, columns and a paginator under rows.
- SettingsController whitelists categories/units/locations/suppliers and rejects cycles in parent hierarchies.
- Product updates freeze unit_id and track_lots after movement history exists; archive requires no positive balance. Both lock the product.
- AuditService strips hidden credentials/tokens/storage paths. PostgreSQL, not Eloquent model hooks, enforces history immutability; see `mem:database`. Transaction/business rules: `mem:stock-domain`.
