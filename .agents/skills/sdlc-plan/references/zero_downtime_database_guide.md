# Database Schema Changes and Zero-Downtime Migration

Read when altering database schemas, persistent data, or data access contracts across application releases. Identify existing data volume, data ownership, backward/forward compatibility, acceptable lock durations, and rollback procedures.

## Expand and Contract Pattern

Apply when zero downtime or multi-version concurrency is required:

1. **Expand**: Add new backward-compatible tables or nullable columns that existing running application code ignores.
2. **Dual-Path / Transitional Phase**: Transition write and read paths. If dual-writing is required, define the authoritative single source of truth and isolate partial failure handling.
3. **Backfill**: Incrementally backfill historical records in batches with checksum reconciliation, resumability, and idempotent operations.
4. **Contract**: Deprecate and drop legacy columns/tables only after all consumers have migrated and data integrity is verified.

Do not mandate dual-writing or multi-phase rollouts if downtime windows are permitted. For destructive schema changes, establish verified snapshot/restore procedures prior to execution. Never assume `migration down` scripts are universally safe or lossless.

## Migration Verification

Validate migrations against representative database engines and datasets. Audit table locks, index builds (`CONCURRENTLY`), foreign key constraints, and query execution plans against engine version documentation. Note that `EXPLAIN ANALYZE` actually executes the query. Never extrapolate production PostgreSQL behavior from local SQLite tests when operational semantics or locking rules diverge.
