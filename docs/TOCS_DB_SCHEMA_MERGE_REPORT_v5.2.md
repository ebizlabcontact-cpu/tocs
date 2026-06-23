# TOCS DB Schema Merge Report v5.2

## Result

`tocs_patch_profit_engine_latest_version.sql` was merged into `tocs_supplement.sql`.

## Files Generated

- `tocs_supplement_MERGED_v5.2.sql`
- `DB_APPLY_ORDER_v5.2.md`

## Verified Facts

- Only `v_formula_profit_engine` is changed.
- Other views remain present with the same object count.
- The old latest snapshot order by `created_at DESC` alone is removed.
- The new latest snapshot order is:

```sql
ORDER BY fcs.formula_id, fv.version_no DESC, fcs.created_at DESC, fcs.id DESC
```

## Diff

```diff
--- old v_formula_profit_engine in tocs_supplement.sql
+++ merged v_formula_profit_engine
@@ -7,10 +7,19 @@
     WHERE status = 'COMPLETED' AND NOT is_canceled GROUP BY formula_id
 ),
 expected_base AS (
-    SELECT DISTINCT ON (formula_id) formula_id,
-        net_profit AS expected_net_profit, profit_rate AS expected_profit_rate,
-        total_sell_amount, total_buy_amount, total_cost, total_share
-    FROM formula_calculation_snapshots ORDER BY formula_id, created_at DESC
+    -- [수정] formula_calculation_snapshots와 formula_versions를 LEFT JOIN하여
+    -- "최신"의 1차 기준을 fv.version_no DESC로 변경.
+    -- LEFT JOIN을 사용한 이유: formula_calculation_snapshots.formula_version_id는
+    -- nullable FK이며, 향후 운영 데이터에서 NULL인 snapshot이 생겨도
+    -- (version_no는 NULL로 처리되어 정렬 최하위로 밀릴 뿐) 해당 formula_id가
+    -- expected_base에서 통째로 누락되지 않도록 한다. INNER JOIN을 쓰면
+    -- formula_version_id가 NULL인 snapshot을 가진 formula 전체가 사라진다.
+    SELECT DISTINCT ON (fcs.formula_id) fcs.formula_id,
+        fcs.net_profit AS expected_net_profit, fcs.profit_rate AS expected_profit_rate,
+        fcs.total_sell_amount, fcs.total_buy_amount, fcs.total_cost, fcs.total_share
+    FROM formula_calculation_snapshots fcs
+    LEFT JOIN formula_versions fv ON fv.id = fcs.formula_version_id
+    ORDER BY fcs.formula_id, fv.version_no DESC, fcs.created_at DESC, fcs.id DESC
 )
 SELECT
     f.id AS formula_id, f.formula_no,
```
