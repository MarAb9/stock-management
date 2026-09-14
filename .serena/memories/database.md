# Database
- Schema truth: `backend/database/migrations`; PostgreSQL 16 in Compose. Read the 2026_09_10_080129 hardening migration alongside original create-table migrations.
- Categories and locations have nullable self-parent keys; products require a unit and optionally link category/supplier. Products and assets soft-delete. Location code, product reference/barcode and asset inventory/serial identifiers have uniqueness constraints.
- Stock lots belong to products; (product_id, lot_number) is unique. Balances use (product_id, location_id, stock_lot_id); a partial unique index covers null-lot rows, which ordinary composite uniqueness would miss.
- Movement links product/optional lot, source/destination locations and actor; operation_reference groups a multi-lot operation. Quantity fields are DECIMAL(14,3); prices/costs generally DECIMAL(14,2).
- Inventory session -> lines keyed by session/product/location/lot, with a second partial index for no-lot lines. Lines store theoretical/physical/variance and adjustment_id -> stock_movements; session stores last_movement_id and validator.
- Assets have their own location, assignee text, condition/status and identity; asset_operations and asset_maintenances reference assets. They do not link to stock balances.
- Audit stores entity class/id plus JSON before/after values. Attachments use entity_type/entity_id (not a cross-table FK); institution_settings stores institution details.
- PostgreSQL-only hardening adds nonnegative balances/counts, positive movements, source/destination/direction checks and lot date checks. Triggers reject UPDATE/DELETE on stock_movements, audit_logs and asset_operations. Many historical FKs restrict deletion.
- SQLite tests omit these PostgreSQL checks/triggers and cannot establish row-lock behavior. Application transaction/lock flow: `mem:stock-domain`.
