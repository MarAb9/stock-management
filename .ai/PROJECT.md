# Project

Internal stock management for Conseil Scientifique Local de Berkane.
Existing implementation roadmap: ../PLAN.md. French user interface.
Angular 21 standalone frontend; Laravel 13 API, Sanctum sessions, DomPDF;
PostgreSQL for deployment, SQLite in-memory for isolated backend tests.
Stock movements are immutable; balances project product/location/lot quantities.
Stock and inventory operations must be transactional and prevent negative stock.

Work in bounded Codex implementation tasks: inspect, edit, targeted validation,
review, checkpoint, update state. No unrelated refactoring or unnecessary dependencies.
Small tasks: targeted tests. Features: feature tests and typecheck.
Milestones: full suite and build. Release: full verification.
Keep secrets, dependencies and runtime data out of Git.
