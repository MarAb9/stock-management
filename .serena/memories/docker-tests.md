# Docker and checks
- Run Compose from repository root. Services are backend (PHP 8.4 CLI, port 8000) and database (PostgreSQL 16, port 5432, named postgres_data volume); Angular is a host process on 4200.
- Backend image installs bcmath, pdo_pgsql and pdo_sqlite. Compose bind-mounts backend at /app, so host files/dependencies override image contents. Migrations/seeding are explicit, not automatic startup work.
- Start/rebuild services: `docker compose up --build -d`. Apply schema when requested: `docker compose exec -T backend php artisan migrate`; seeding is separate and uses local environment configuration.
- Frontend (working directory frontend): `npm start`, `npm run build`, `npm test -- --watch=false`. On PowerShell with blocked npm.ps1, use npm.cmd.
- Backend suite: `docker compose exec -T backend php artisan test`. Narrow with --filter=StockServiceTest, InventoryServiceTest or AuthTest. Style inside container: `docker compose exec -T backend vendor/bin/pint --dirty --format agent`.
- `backend/phpunit.xml` forces SQLite :memory:, array sessions/cache and sync queues even inside the PostgreSQL-configured container. Use PostgreSQL-specific verification for constraints/triggers/concurrency changes; a green SQLite suite does not prove those guarantees.
- Canonical verification/progress reference remains `docs/PROJECT_STATUS.md`.
- Serena: PHP + Angular language servers in .serena/project.yml; dependency/generated paths excluded, cache/local config untracked. Check memory links with `serena memories check .`; on Windows set PYTHONIOENCODING=utf-8 if the CLI cannot print Unicode. Prefer targeted symbol queries over whole-project reindexing.
