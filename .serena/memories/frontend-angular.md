# Frontend Angular
- `frontend/src/main.ts` bootstraps the standalone App with app.config.ts. app.routes.ts lazy-loads French routes under a guarded ShellComponent; connexion is public.
- `core/api.service.ts` contains ApiService, authGuard, authInterceptor, User and Page types. Shared signals hold current user, errors, notices and pending-request count; no token persistence or separate state library.
- Login first GETs /sanctum/csrf-cookie, then POSTs /api/auth/login. Guard fetches auth/me. Interceptor adds JSON Accept, surfaces backend validation errors and redirects on 401/419.
- Relative /api and /sanctum requests depend on `frontend/proxy.conf.json` and Angular's same-origin XSRF handling. Do not assume direct cross-origin credential support.
- Pages in `src/app/pages` call ApiService directly; signals store lists/selections. Reactive forms handle most entry flows; inventory line counts use FormsModule. Templates/styles are commonly inline, with Angular Material/CDK and global SCSS/Tailwind.
- Preserve backend paginator shapes and snake_case fields; inventory edits refetch session lines and asset operations refetch histories. Stock calculations remain server-side.
- Report downloads use ApiService.saveFile/download as blobs; previews and exports share filters.
- TypeScript and Angular templates use strict checking. Component tests use Angular's unit-test builder/Vitest. Runtime and checks: `mem:docker-tests`.
