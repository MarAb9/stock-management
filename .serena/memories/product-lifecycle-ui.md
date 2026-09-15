# Product lifecycle UI - 2026-09-15
- Routes/components: `/produits` uses `ProductsComponent`; `/produits/nouveau` and `/produits/:id` share `ProductDetailComponent` for create, detail, and edit.
- List: compact typed table with server-side search/category/supplier/stock/active filters, active-filter summary/reset, pagination, and distinct initial-empty vs no-match states.
- Detail: identity/configuration plus backend-provided total stock and derived display state; reference data is loaded only for create/edit.
- Create/edit: one typed Reactive Form matches `ProductRequest`, normalizes nullable fields, validates maximum against minimum, preserves input, and maps Laravel 422 field errors.
- Immutable fields: product detail exposes `has_movements`; unit and lot tracking are disabled with an explanation after movement history exists, while backend validation remains authoritative.
- Archive: Material confirmation names the product; positive-stock errors are shown in context; success reloads the list or navigates from detail. Archival remains soft-delete/history-preserving backend behavior.
- Lots/balances: detail loads balances from the existing endpoint and loads lots only for lot-tracked products; zero balances are omitted from display and no expiration threshold was invented.
- Tests/verification: product frontend specs cover 14 behaviors; full Angular suite passed 9 files/51 tests and production build passed. Product backend test passed 1 test/4 assertions; full Laravel suite passed 21 tests/191 assertions; Pint passed for changed PHP files.
- Remaining product gaps: none known in the requested lifecycle scope.