-- =============================================================================
-- TOCS TEST-009 View 검증 SQL — Formula Version Engine 검증
-- =============================================================================
-- 전제: base + supplement + amount_verified fix + TEST-001~008 + TEST-009 seed
--       순서대로 적용 완료된 상태
--
-- formula_id (TEST-009) = '90090000-0000-0000-0003-000000000001'
-- participant_id(GioWorks Version) = '90090000-0000-0000-0004-000000000002'
-- =============================================================================

\echo '=== 1. Formula 생성 확인 ==='
SELECT formula_no, trade_type, quantity, is_closed
FROM formulas
WHERE id = '90090000-0000-0000-0003-000000000001';

-- 예상값: formula_no는 'FM-2606-%' 형식의 자동 채번값, quantity=1000, is_closed=FALSE


\echo '=== 2. Version 1 확인 ==='
SELECT version_no, changed_by, change_reason, snapshot
FROM formula_versions
WHERE formula_id = '90090000-0000-0000-0003-000000000001' AND version_no = 1;

-- 예상값: version_no=1, snapshot에 buy_unit_price=1000, total_buy_amount=1000000 포함


\echo '=== 3. Version 2 확인 ==='
SELECT version_no, changed_by, change_reason, snapshot
FROM formula_versions
WHERE formula_id = '90090000-0000-0000-0003-000000000001' AND version_no = 2;

-- 예상값: version_no=2, snapshot에 buy_unit_price=1200, total_buy_amount=1200000 포함,
--        change_reason에 변경 사유("매입단가 변경") 텍스트 포함


\echo '=== 4. Version No 증가 확인 (V1=1, V2=2, UNIQUE 보장 확인) ==='
SELECT
    version_no,
    LAG(version_no) OVER (ORDER BY version_no) AS prev_version_no,
    CASE WHEN version_no - COALESCE(LAG(version_no) OVER (ORDER BY version_no), 0) = 1
         THEN 'PASS' ELSE 'FAIL' END AS increment_check
FROM formula_versions
WHERE formula_id = '90090000-0000-0000-0003-000000000001'
ORDER BY version_no;

-- 예상값: 2행. version_no=1(증가확인 불필요, 첫 행), version_no=2 -> increment_check='PASS'


\echo '=== 5. Snapshot 2건 존재 확인 ==='
SELECT
    COUNT(*) AS snapshot_count,
    CASE WHEN COUNT(*) = 2 THEN 'PASS' ELSE 'FAIL' END AS snapshot_count_check
FROM formula_calculation_snapshots
WHERE formula_id = '90090000-0000-0000-0003-000000000001';

-- 예상값: snapshot_count=2, PASS


\echo '=== 6. V1 Snapshot 값 검증 ==='
SELECT
    fcs.total_buy_amount, fcs.total_sell_amount, fcs.net_profit,
    CASE WHEN fcs.total_buy_amount=1000000 AND fcs.total_sell_amount=2000000
              AND fcs.net_profit=1000000
         THEN 'PASS' ELSE 'FAIL' END AS v1_value_check
FROM formula_calculation_snapshots fcs
JOIN formula_versions fv ON fv.id = fcs.formula_version_id
WHERE fv.formula_id = '90090000-0000-0000-0003-000000000001' AND fv.version_no = 1;

-- 예상값: total_buy_amount=1,000,000, total_sell_amount=2,000,000, net_profit=1,000,000, PASS


\echo '=== 7. V2 Snapshot 값 검증 ==='
SELECT
    fcs.total_buy_amount, fcs.total_sell_amount, fcs.net_profit,
    CASE WHEN fcs.total_buy_amount=1200000 AND fcs.total_sell_amount=2000000
              AND fcs.net_profit=800000
         THEN 'PASS' ELSE 'FAIL' END AS v2_value_check
FROM formula_calculation_snapshots fcs
JOIN formula_versions fv ON fv.id = fcs.formula_version_id
WHERE fv.formula_id = '90090000-0000-0000-0003-000000000001' AND fv.version_no = 2;

-- 예상값: total_buy_amount=1,200,000, total_sell_amount=2,000,000, net_profit=800,000, PASS


\echo '=== 7-1. V1 Snapshot이 V2 생성 후에도 변경되지 않고 그대로 보존되는지 재확인 ==='
-- V1 snapshot 행이 UPDATE된 적이 없으므로 created_at이 V2보다 먼저여야 하고,
-- V1의 net_profit이 여전히 1,000,000(800,000으로 덮어써지지 않았는지)이어야 한다.
SELECT
    fv.version_no, fcs.net_profit, fcs.created_at,
    CASE WHEN fv.version_no=1 AND fcs.net_profit=1000000 THEN 'PASS'
         WHEN fv.version_no=2 AND fcs.net_profit=800000 THEN 'PASS'
         ELSE 'FAIL' END AS preservation_check
FROM formula_calculation_snapshots fcs
JOIN formula_versions fv ON fv.id = fcs.formula_version_id
WHERE fv.formula_id = '90090000-0000-0000-0003-000000000001'
ORDER BY fv.version_no;

-- 예상값: 2행 모두 PASS. V1 행이 800,000으로 바뀌어 있다면 "분리 보존" 실패를 의미.


\echo '=== 8. Audit Log 존재 확인 ==='
SELECT table_name, record_id, action, changed_by, old_data, new_data
FROM audit_logs
WHERE record_id = '90090000-0000-0000-0004-000000000002'
  AND action = 'VERSION_CREATE';

-- 예상값: 1건. old_data에 version_no=1/buy_unit_price=1000,
--        new_data에 version_no=2/buy_unit_price=1200 및 변경 사유 포함


\echo '=== 9. formula_no 동일 유지 확인 (Version 증가가 formula_no를 바꾸지 않는지) ==='
SELECT
    f.formula_no,
    CASE WHEN f.formula_no IS NOT NULL AND f.formula_no LIKE 'FM-2606-%'
         THEN 'PASS' ELSE 'FAIL' END AS formula_no_unchanged_check
FROM formulas f
WHERE f.id = '90090000-0000-0000-0003-000000000001';

-- 예상값: PASS. (formula_no는 V1/V2 전환 과정에서 단 한 번도 UPDATE 대상이 아니었음을
--        Seed 자체가 보장하며, 여기서는 형식이 여전히 정상인지 직접 재확인)


\echo '=== 10. 최신 Version 조회 확인 ==='
SELECT version_no, change_reason
FROM formula_versions
WHERE formula_id = '90090000-0000-0000-0003-000000000001'
ORDER BY version_no DESC
LIMIT 1;

-- 예상값: version_no=2 (최신)


\echo '=== 11. 이전 Version 조회 확인 ==='
SELECT version_no, change_reason
FROM formula_versions
WHERE formula_id = '90090000-0000-0000-0003-000000000001'
ORDER BY version_no ASC
LIMIT 1;

-- 예상값: version_no=1 (최초)


\echo '=== 12. Expected Profit 변화 검증 (v_formula_profit_engine은 최신 snapshot만 반영하는지) ==='
SELECT
    expected_buy, expected_revenue, expected_net_profit,
    CASE WHEN expected_buy=1200000 AND expected_net_profit=800000
         THEN 'PASS (최신 V2 반영됨)' ELSE 'FAIL' END AS latest_snapshot_check
FROM v_formula_profit_engine
WHERE formula_id = '90090000-0000-0000-0003-000000000001';

-- 예상값: expected_buy=1,200,000, expected_net_profit=800,000.
-- [구조적 참고] v_formula_profit_engine은 DISTINCT ON (formula_id) ORDER BY created_at DESC
-- 로 "가장 최근 snapshot 1건"만 반영하므로 V1 snapshot은 더 이상 이 View에 보이지 않는다.
-- 이는 결함이 아니라 "현재 유효한 예상값"을 보여주는 View의 의도된 동작이며,
-- V1 snapshot 자체는 7-1번 쿼리처럼 formula_calculation_snapshots 테이블에 별도로
-- 영구 보존되어 있다.


\echo '=== 13. Payment/Invoice/Logistics/Share 데이터 무결성 확인 ==='
SELECT 'payment_schedule' AS data_type, COUNT(*) AS cnt
FROM formula_payment_schedules WHERE formula_id = '90090000-0000-0000-0003-000000000001'
UNION ALL
SELECT 'invoice', COUNT(*) FROM formula_invoices WHERE formula_id = '90090000-0000-0000-0003-000000000001'
UNION ALL
SELECT 'logistics', COUNT(*) FROM formula_logistics WHERE formula_id = '90090000-0000-0000-0003-000000000001'
UNION ALL
SELECT 'share', COUNT(*) FROM formula_shares WHERE formula_id = '90090000-0000-0000-0003-000000000001';

-- 예상값: 4행 모두 cnt=1 (Version 변경 전 등록한 4개 데이터가 전부 그대로 남아있어야 함)


\echo '=== 14. Expected vs Actual 종합 비교 (PASS/FAIL 자동 판정) ==='
WITH expected(metric, expected_value) AS (
    VALUES
        ('v1_total_buy',    1000000::numeric),
        ('v1_total_sell',   2000000::numeric),
        ('v1_net_profit',   1000000::numeric),
        ('v2_total_buy',    1200000::numeric),
        ('v2_total_sell',   2000000::numeric),
        ('v2_net_profit',    800000::numeric),
        ('version_count',         2::numeric),
        ('payment_schedule_count', 1::numeric),
        ('invoice_count',          1::numeric),
        ('logistics_count',        1::numeric),
        ('share_count',            1::numeric)
),
v1 AS (
    SELECT fcs.total_buy_amount, fcs.total_sell_amount, fcs.net_profit
    FROM formula_calculation_snapshots fcs
    JOIN formula_versions fv ON fv.id = fcs.formula_version_id
    WHERE fv.formula_id = '90090000-0000-0000-0003-000000000001' AND fv.version_no = 1
),
v2 AS (
    SELECT fcs.total_buy_amount, fcs.total_sell_amount, fcs.net_profit
    FROM formula_calculation_snapshots fcs
    JOIN formula_versions fv ON fv.id = fcs.formula_version_id
    WHERE fv.formula_id = '90090000-0000-0000-0003-000000000001' AND fv.version_no = 2
),
counts AS (
    SELECT
        (SELECT COUNT(*) FROM formula_versions WHERE formula_id = '90090000-0000-0000-0003-000000000001') AS version_count,
        (SELECT COUNT(*) FROM formula_payment_schedules WHERE formula_id = '90090000-0000-0000-0003-000000000001') AS payment_schedule_count,
        (SELECT COUNT(*) FROM formula_invoices WHERE formula_id = '90090000-0000-0000-0003-000000000001') AS invoice_count,
        (SELECT COUNT(*) FROM formula_logistics WHERE formula_id = '90090000-0000-0000-0003-000000000001') AS logistics_count,
        (SELECT COUNT(*) FROM formula_shares WHERE formula_id = '90090000-0000-0000-0003-000000000001') AS share_count
),
actual AS (
    SELECT 'v1_total_buy'  AS metric, v1.total_buy_amount  AS actual_value FROM v1 UNION ALL
    SELECT 'v1_total_sell',          v1.total_sell_amount  FROM v1 UNION ALL
    SELECT 'v1_net_profit',          v1.net_profit         FROM v1 UNION ALL
    SELECT 'v2_total_buy',           v2.total_buy_amount   FROM v2 UNION ALL
    SELECT 'v2_total_sell',          v2.total_sell_amount  FROM v2 UNION ALL
    SELECT 'v2_net_profit',          v2.net_profit         FROM v2 UNION ALL
    SELECT 'version_count',          counts.version_count::numeric FROM counts UNION ALL
    SELECT 'payment_schedule_count', counts.payment_schedule_count::numeric FROM counts UNION ALL
    SELECT 'invoice_count',          counts.invoice_count::numeric FROM counts UNION ALL
    SELECT 'logistics_count',        counts.logistics_count::numeric FROM counts UNION ALL
    SELECT 'share_count',            counts.share_count::numeric FROM counts
)
SELECT
    e.metric, e.expected_value, a.actual_value,
    CASE WHEN e.expected_value = a.actual_value THEN 'PASS' ELSE 'FAIL' END AS result
FROM expected e
JOIN actual a ON a.metric = e.metric
ORDER BY e.metric;

-- 11개 행 전부 result='PASS'가 나와야 정상.
