# Current milestone

Improve reference-data/forms coverage after core stock, inventory, and equipment flows.

# Completed

- Laravel/Sanctum backend and Angular admin frontend are present.
- Database covers users, reference data, products, lots, stock balances, movements, assets, maintenance, inventory sessions/lines, attachments, settings, and audit logs.
- Stock movements are transaction-based, audited, and project balances by product, location, and lot.
- Backend protects negative stock exits and transfers, validates decimal quantities, enforces lot ownership/expiration, allocates lot-tracked exits by FEFO, and rolls back failed multi-lot operations.
- Auth tests cover the current session/Sanctum login behavior.
- Docker backend image builds with PostgreSQL, SQLite, and bcmath support.
- Inventory sessions snapshot stock by location/lot, require variance reasons, reject stale or repeated validation, create linked adjustment movements, and the Angular inventory page loads/counts lines through the real API.
- Equipment page can create assets, run assignment/transfer/return operations, add maintenance, update maintenance status, and view operation/maintenance history through real API endpoints.
- PDF/CSV reporting endpoints and document templates exist.

# In progress

- Reference-data and form completeness review.

# Next

- Improve reference-data/forms coverage after equipment workflows.
- Broaden backend coverage for asset operations and maintenance rules.

# Known issues

- No blocking known issues in completed stock, inventory, or equipment UI slices.

# Verification

- Backend targeted tests: `docker compose exec -T backend php artisan test --filter=StockServiceTest`
- Inventory targeted tests: `docker compose exec -T backend php artisan test --filter=InventoryServiceTest`
- Backend suite: `docker compose exec -T backend php artisan test`
- Backend style: `cd backend; vendor/bin/pint --dirty --format agent`
- Frontend tests: `cd frontend; npm test -- --watch=false`
- Frontend build: `cd frontend; npm run build`
- Runtime: `docker compose up --build -d`
