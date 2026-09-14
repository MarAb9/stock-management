## Context strategy

Do NOT rediscover the entire repository at the beginning of each task.

For every future task, use this order:

1. Read `AGENTS.md`.
2. Read `docs/PROJECT_STATUS.md`.
3. Inspect `git status` and recent commits.
4. Read only the relevant Serena project memory.
5. Use Serena symbol search/reference tools to locate relevant code.
6. Open full files only when necessary.
7. Never rediscover the complete repository unless genuinely required.

Prefer Serena operations such as:
- symbol overview
- find symbol
- find references
- find implementations

Do not recursively inspect directories or reread unrelated modules simply to
reconstruct project architecture.

Ignore generated/dependency directories during discovery: `node_modules`,
`vendor`, `dist`, `build`, `coverage`, Angular caches, and storage logs/cache.

After completing a substantial architectural or business-rule change:
- update the relevant Serena memory
- keep it concise
- update `docs/PROJECT_STATUS.md` only when development progress changes

Keep memories concise.
Do not copy source code into memories.
Do not duplicate `AGENTS.md` or `docs/PROJECT_STATUS.md`, or document every file.
Source code remains the source of truth.
`docs/PROJECT_STATUS.md` remains the source of truth for current development progress.

# Project Rules

The product source of truth is `X:\master specs.txt`; read targeted sections only when needed. The Git repository is the current implementation truth.

This is an early-stage Laravel/Sanctum API and Angular admin app for the Conseil Scientifique Local de Berkane. Do not restart, rewrite, or build speculative future modules.

Stock integrity is critical. Stock changes must go through traceable business operations, preserve movement history, reject negative stock server-side, and use transactions with appropriate locking when multiple records are affected. Historical movements, audit logs, and asset operations are immutable; corrections should create explicit movements.

Consumable products and individually tracked assets are different domain objects. Do not reduce equipment to simple quantities when asset identity, condition, assignment, maintenance, or history matters.

Use existing Docker, Laravel, Angular, and database patterns. Prefer built-in framework features and existing dependencies over new packages or abstractions.

Before each development slice: check Git status/branch, fetch remote changes, inspect recent commits and relevant diffs, protect unrelated uncommitted work, implement one coherent slice, run targeted verification, update `docs/PROJECT_STATUS.md`, then commit and push if verification passes.

Never commit secrets, real credentials, `.env` values, temporary debug files, generated junk, `vendor`, or `node_modules`.
