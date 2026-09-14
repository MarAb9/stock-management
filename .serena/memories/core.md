# Core
- Single Git repository for the Conseil Scientifique Local de Berkane stock admin: Laravel API in `backend/`, Angular SPA in `frontend/`.
- Durable source map only: repository rules are in `AGENTS.md`; live progress and pending work are in `docs/PROJECT_STATUS.md`. Product specification pointer is in AGENTS; memories never replace implementation.
- For request flow, deployment boundaries and document generation: `mem:architecture`.
- For HTTP validation, session authentication and backend extension points: `mem:backend-laravel`.
- For routing, shared HTTP handling and component state/forms: `mem:frontend-angular`.
- For quantities, lot allocation, inventories and equipment transitions: `mem:stock-domain`.
- For relational keys, decimal precision and PostgreSQL-only protections: `mem:database`.
- For running services, canonical checks and SQLite test limitations: `mem:docker-tests`.
