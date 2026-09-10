# Current bounded task

Verify shared stock movement correctness (PLAN.md step 1).
Scope: StockService, request validation, relevant models/migrations and tests.
Trace all callers; regress exact decimals, product/lot ownership, expiration,
FEFO across lots, and transaction rollback on insufficiency or overflow.
Fix demonstrated defects at their shared source. No dependencies or unrelated edits.
Validate with focused backend tests and required formatting on changed PHP files.
Worker stops and reports changed files, checks and limitations; master reviews
and checkpoints before selecting the next task.
