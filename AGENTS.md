# Project Rules

The product source of truth is `X:\master specs.txt`; read targeted sections only when needed. The Git repository is the current implementation truth.

This is an early-stage Laravel/Sanctum API and Angular admin app for the Conseil Scientifique Local de Berkane. Do not restart, rewrite, or build speculative future modules.

Stock integrity is critical. Stock changes must go through traceable business operations, preserve movement history, reject negative stock server-side, and use transactions with appropriate locking when multiple records are affected. Historical movements, audit logs, and asset operations are immutable; corrections should create explicit movements.

Consumable products and individually tracked assets are different domain objects. Do not reduce equipment to simple quantities when asset identity, condition, assignment, maintenance, or history matters.

Use existing Docker, Laravel, Angular, and database patterns. Prefer built-in framework features and existing dependencies over new packages or abstractions.

Before each development slice: check Git status/branch, fetch remote changes, inspect recent commits and relevant diffs, protect unrelated uncommitted work, implement one coherent slice, run targeted verification, update `docs/PROJECT_STATUS.md`, then commit and push if verification passes.

Never commit secrets, real credentials, `.env` values, temporary debug files, generated junk, `vendor`, or `node_modules`.
