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
(existing Sass deprecation warning).
Inventory slice complete: backend tests cover location/lot snapshots, variance
reasons, stale/repeat validation rejection and linked adjustments; Angular
inventory page now loads lines through the real API and exposes reason/comment
fields. Frontend test drift fixed.
Equipment UI slice complete: page can create assets, run assignment/transfer/
return operations, add maintenance, update maintenance status and list operation/
maintenance history through real endpoints.
Reference-data UI slice complete: settings page now creates units with API
symbols and exposes the backend's category, location and supplier fields; focused
frontend test covers unit payload shape.
Reports UI slice complete: page previews all generic report types, keeps filters
on PDF/CSV exports and has a focused frontend test for export paths.
Next: asset operation backend coverage, remaining form validation alignment,
authentication/security hardening, milestone verification, following PLAN.md.
