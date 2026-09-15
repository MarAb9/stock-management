# Frontend feedback system
- `ApiService` remains the HTTP/session owner. `authInterceptor` counts real API/Sanctum activity, maps failures to safe French messages, and handles 401/419 without duplicate redirects. `App` presents those signals through accessible Material snackbars and a progress bar delayed by 180 ms.
- Laravel 422 field errors use `applyBackendValidation`; it preserves existing control errors, marks matching controls touched, supports aliases such as stock `location`, and returns unmapped messages as a form fallback.
- Important mutations use local signal guards plus `finalize` to prevent duplicate submits. Successful product, stock, equipment, inventory, settings and export actions call `ApiService.success` for one consistent snackbar.
- `ConfirmationService` opens one Material dialog pattern with cancel-first focus and focus restoration. Inventory validation and terminal maintenance transitions state the affected object and irreversibility.
- Empty states render only after loading. Product search and report filters distinguish no data from no matches and offer reset/create actions; other major lists use specific compact messages.
- Session expiry clears the in-memory user, redirects once to `/connexion`, and preserves a safe internal `returnUrl`; login errors retain network/rate-limit detail. No token storage or refresh-token flow was added.
- Tests cover status mapping, request counting, session redirects, 422 mapping, snackbar success, delayed loading, confirmation decisions, stock regression/success, and true versus filtered empty results.
- Verified 2026-09-15: `npm test -- --watch=false` passed 7 files / 24 tests; `npm run build` passed. Both retain the existing Sass `@import` deprecation warning.
