# State

2026-09-10: Inspected existing application and PLAN.md; initialized Git.
Baseline checkpoint: 6d78449. Existing implementation is
not yet certified complete. StockService has only one regression test;
WorkflowTest is a placeholder. Inventory UI lacks variance reason inputs.

Stock correctness slice complete: decimal quantities, lot ownership, expiry,
multi-lot FEFO, audit and rollback behavior covered. Docker backend image now
installs PostgreSQL, SQLite and bcmath extensions and builds cleanly. Auth test
now covers session/Sanctum login instead of obsolete token login.
Backend suite: 12 tests, 148 assertions. Frontend production build passed
(existing Sass deprecation warning). Frontend starter test still has an obsolete
assertion. Inventory screen/API mismatch confirmed.
Next: inventory correctness, equipment, reference data/reports, complete UI,
authentication/security hardening, milestone verification, following PLAN.md.
