# Current milestone

Frontend/backend form contracts are aligned for the current data-entry flows.

# Completed

- Laravel/Sanctum backend and Angular admin frontend are present.
- Database covers users, reference data, products, lots, stock balances, movements, assets, maintenance, inventory sessions/lines, attachments, settings, and audit logs.
- Stock movements are transaction-based, audited, and project balances by product, location, and lot.
- Backend protects negative stock exits and transfers, validates decimal quantities, enforces lot ownership/expiration, allocates lot-tracked exits by FEFO, and rolls back failed multi-lot operations.
- Auth tests cover the current session/Sanctum login behavior.
- Docker backend image builds with PostgreSQL, SQLite, and bcmath support.
- Inventory sessions snapshot stock by location/lot, require variance reasons, reject stale or repeated validation, create linked adjustment movements, and the Angular inventory page loads/counts lines through the real API.
- Equipment page can create assets, run assignment/transfer/return operations, add maintenance, update maintenance status, and view operation/maintenance history through real API endpoints.
- Asset service tests cover operation history/blocking and maintenance lifecycle rules.
- Reference-data page creates categories, units, locations, and suppliers with the backend's real fields, including unit symbols and supplier contact details.
- Reports page previews stock, asset, movement, lot, inventory, and consumption reports through the generic report API and exports filtered PDF/CSV files.
- PDF/CSV reporting endpoints and document templates exist.
- Stock movements page now adapts to backend rules for entry, exit, return, transfer, adjustment, loss, and disposal; it supports lot-managed products, FEFO selection, source/destination semantics, validation errors, and grouped FEFO history.
- Frontend feedback is centralized around safe French API messages, accessible snackbars, delayed global HTTP progress, reusable Laravel field-error mapping, guarded mutation buttons, Material confirmations for irreversible actions, session-expiry return URLs, and loaded-aware empty states.
- Inventory session/counting forms and reference-data creation forms use typed Reactive Forms aligned with the current Laravel validation rules, including inline 422 errors and normalized payloads.

# In progress

- No active form-contract alignment slice.

# Next

- No remaining known frontend/backend form-contract alignment issue.

# Known issues

- No blocking known issues in completed stock, inventory, or equipment UI slices.

# Verification

- Backend targeted tests: `docker compose exec -T backend php artisan test --filter=StockServiceTest`
- Inventory targeted tests: `docker compose exec -T backend php artisan test --filter=InventoryServiceTest`
- Backend suite: `docker compose exec -T backend php artisan test`
- Backend style: `cd backend; vendor/bin/pint --dirty --format agent`
- Frontend tests: `cd frontend; npm test -- --watch=false` (8 files / 38 tests passed on 2026-09-15)
- Frontend build: `cd frontend; npm run build` (passed on 2026-09-15)
- Runtime: `docker compose up --build -d`
