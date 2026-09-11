# Current milestone

Complete equipment operations and maintenance history in the UI.

# Completed

- Laravel/Sanctum backend and Angular admin frontend are present.
- Database covers users, reference data, products, lots, stock balances, movements, assets, maintenance, inventory sessions/lines, attachments, settings, and audit logs.
- Stock movements are transaction-based, audited, and project balances by product, location, and lot.
- Backend protects negative stock exits and transfers, validates decimal quantities, enforces lot ownership/expiration, allocates lot-tracked exits by FEFO, and rolls back failed multi-lot operations.
- Auth tests cover the current session/Sanctum login behavior.
- Docker backend image builds with PostgreSQL, SQLite, and bcmath support.
- Inventory sessions snapshot stock by location/lot, require variance reasons, reject stale or repeated validation, create linked adjustment movements, and the Angular inventory page loads/counts lines through the real API.
- PDF/CSV reporting endpoints and document templates exist.

# In progress

- Equipment operations and maintenance UI alignment.

# Next

- Complete equipment operations and maintenance history in the UI.
- Improve reference-data/forms coverage after equipment workflows.

# Known issues

- Equipment operation and maintenance screens are still thin compared with backend capabilities.

# Verification

- Backend targeted tests: `docker compose exec -T backend php artisan test --filter=StockServiceTest`
- Inventory targeted tests: `docker compose exec -T backend php artisan test --filter=InventoryServiceTest`
- Backend suite: `docker compose exec -T backend php artisan test`
- Backend style: `cd backend; vendor/bin/pint --dirty --format agent`
- Frontend tests: `cd frontend; npm test -- --watch=false`
- Frontend build: `cd frontend; npm run build`
- Runtime: `docker compose up --build -d`
