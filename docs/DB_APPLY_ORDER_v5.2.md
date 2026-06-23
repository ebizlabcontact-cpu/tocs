# TOCS DB Apply Order

## Purpose

This document defines the clean DB rebuild order for TOCS after merging the Profit Engine latest snapshot patch into the official supplement schema.

## Final Operating Files

Use these files only for a clean DB build:

1. `db/schema/tocs_base_schema.sql`
2. `db/schema/tocs_supplement.sql`
3. `db/fixes/tocs_fix_amount_verified.sql`

## Important Change

`tocs_patch_profit_engine_latest_version.sql` has been merged into `tocs_supplement.sql`.

After replacing `db/schema/tocs_supplement.sql` with the merged version, the patch file is no longer part of the normal DB apply order.

Recommended archive location:

```text
db/patches/archive/tocs_patch_profit_engine_latest_version.sql
```

## Apply Commands

```powershell
docker cp .\db\schema\tocs_base_schema.sql tocs-postgres:/tmp/tocs_base_schema.sql
docker exec -it tocs-postgres psql -U tocs -d tocs_db -P pager=off -f /tmp/tocs_base_schema.sql

docker cp .\db\schema\tocs_supplement.sql tocs-postgres:/tmp/tocs_supplement.sql
docker exec -it tocs-postgres psql -U tocs -d tocs_db -P pager=off -f /tmp/tocs_supplement.sql

docker cp .\db\fixes\tocs_fix_amount_verified.sql tocs-postgres:/tmp/tocs_fix_amount_verified.sql
docker exec -it tocs-postgres psql -U tocs -d tocs_db -P pager=off -f /tmp/tocs_fix_amount_verified.sql
```

## Required Regression Check

After a clean rebuild, run the minimum regression set:

```text
TEST-001
TEST-006
TEST-009
TEST-010
```

Purpose:

- TEST-001: amount_verified + basic KPI
- TEST-006: close flow
- TEST-009: version snapshot latest-selection logic
- TEST-010: cancel flow

## Production Rule

Do not apply `tocs_patch_profit_engine_latest_version.sql` separately after it is merged into `tocs_supplement.sql`.

If it remains in the repository, keep it only as archived historical evidence.
