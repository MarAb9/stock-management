# Current milestone

Move from hardened stock basics into inventory correctness.

# Completed

- Laravel/Sanctum backend and Angular admin frontend are present.
- Database covers users, reference data, products, lots, stock balances, movements, assets, maintenance, inventory sessions/lines, attachments, settings, and audit logs.
- Stock movements are transaction-based, audited, and project balances by product, location, and lot.
- Backend protects negative stock exits and transfers, validates decimal quantities, enforces lot ownership/expiration, allocates lot-tracked exits by FEFO, and rolls back failed multi-lot operations.
- Auth tests cover the current session/Sanctum login behavior.
- Docker backend image builds with PostgreSQL, SQLite, and bcmath support.
- PDF/CSV reporting endpoints and document templates exist.

# In progress

- Inventory session correctness and UI/API alignment.

# Next

- Validate inventory sessions by location and lot, including repeat-validation protection and adjustment links.
- Complete equipment operations and maintenance history in the UI.
- Fix frontend starter test drift.

# Known issues

- Frontend starter test has an obsolete assertion.
- Inventory screen and API are not fully aligned for variance reasons and lot/location details.

# Verification

- Backend targeted tests: `docker compose exec -T backend php artisan test --filter=StockServiceTest`
- Backend suite: `docker compose exec -T backend php artisan test`
- Backend style: `cd backend; vendor/bin/pint --dirty --format agent`
- Frontend build: `cd frontend; npm run build`
- Runtime: `docker compose up --build -d`
