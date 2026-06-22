-- =============================================================================
-- TOCS TEST-007 View 검증 SQL — Share Engine 검증
-- =============================================================================
-- 전제: base + supplement + amount_verified fix + TEST-001~006 + TEST-007 seed
--       순서대로 적용 완료된 상태
--
-- formula_id (TEST-007) = '90070000-0000-0000-0003-000000000001'
-- participant_id(GioWorks Share) = '90070000-0000-0000-0004-000000000002'
-- =============================================================================

\echo '=== 1. formula_shares 직접 확인 (정액/정률 2건) ==='
SELECT
    tc.company_name AS target_company,
    fs.share_basis, fs.share_method, fs.share_rate, fs.share_amount, fs.memo
FROM formula_shares fs
JOIN companies tc ON tc.id = fs.target_company_id
WHERE fs.formula_id = '90070000-0000-0000-0003-000000000001'
ORDER BY fs.share_amount DESC;

-- 예상값:
--   Share Partner A: share_basis=DIRECT,  share_method=FIXED_AMOUNT, share_rate=NULL, share_amount=200,000
--   Share Partner B: share_basis=PROFIT,  share_method=RATE,         share_rate=10.0000, share_amount=100,000


\echo '=== 2. formula_shares SUM과 snapshot.total_share 일치 검증 (Source of Truth 핵심 검증) ==='
WITH share_sum AS (
    SELECT SUM(share_amount) AS sum_from_shares
    FROM formula_shares
    WHERE formula_id = '90070000-0000-0000-0003-000000000001'
),
snapshot_value AS (
    SELECT total_share AS value_from_snapshot
    FROM formula_calculation_snapshots
    WHERE formula_id = '90070000-0000-0000-0003-000000000001'
    ORDER BY created_at DESC LIMIT 1
)
SELECT
    s.sum_from_shares,
    sv.value_from_snapshot,
    CASE WHEN s.sum_from_shares = sv.value_from_snapshot THEN 'PASS' ELSE 'FAIL' END AS source_of_truth_check
FROM share_sum s, snapshot_value sv;

-- PASS여야 함. formula_shares 2건의 SUM(300,000)과 snapshot.total_share(300,000)가
-- 반드시 일치해야 "formula_shares가 Source of Truth"라는 명제가 실증된다.
-- [구조적 참고] v_formula_profit_engine.expected_share는 formula_shares를 직접 SUM하지 않고
-- formula_calculation_snapshots.total_share를 읽는다. 따라서 이 둘의 일치는 DB가 자동
-- 보장하지 않으며, API 레이어가 formula_shares 변경 시 snapshot도 함께 갱신해야 하는 책임이다.


\echo '=== 3. formula_participants에 share_amount 컬럼이 존재하지 않음을 확인 ==='
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'formula_participants'
  AND column_name LIKE '%share%';

-- 예상값: 0 rows (share 관련 컬럼이 formula_participants에 전혀 없어야 함)


\echo '=== 4. v_formula_profit_engine (확정순이익 vs 예상순이익) ==='
SELECT
    formula_no,
    confirmed_revenue, confirmed_cost_total, confirmed_net_profit,
    expected_revenue, expected_buy, expected_cost, expected_share,
    expected_net_profit, expected_profit_rate
FROM v_formula_profit_engine
WHERE formula_id = '90070000-0000-0000-0003-000000000001';

-- 예상값:
--   confirmed_net_profit = 700,000  (실입금2,000,000 - 실출금1,300,000[매입+셰어2건])
--   expected_net_profit  = 700,000  (2,000,000-1,000,000-0-300,000)
--   주의: 이번 케이스는 모든 셰어가 실제 출금되었으므로 두 값이 "정상적으로" 같게 나온다.
--        TEST-004/005에서 검증한 "확정≠예상"과 모순이 아니다 - 계산 경로가 분리되어
--        있는지가 핵심이며(아래 5번 쿼리), 결과값의 동일/상이는 케이스에 따라 달라질 뿐이다.


\echo '=== 5. 계산 경로 분리 증명 (confirmed와 expected가 서로 다른 테이블/계산을 거치는지) ==='
WITH confirmed_path AS (
    -- 확정순이익 경로: formula_payment_records 직접 SUM
    SELECT
        SUM(actual_amount) FILTER (WHERE direction='IN')  AS in_sum,
        SUM(actual_amount) FILTER (WHERE direction='OUT') AS out_sum
    FROM formula_payment_records
    WHERE formula_id = '90070000-0000-0000-0003-000000000001'
      AND status='COMPLETED' AND NOT is_canceled
),
expected_path AS (
    -- 예상순이익 경로: formula_calculation_snapshots 직접 조회
    SELECT total_sell_amount, total_buy_amount, total_cost, total_share, net_profit
    FROM formula_calculation_snapshots
    WHERE formula_id = '90070000-0000-0000-0003-000000000001'
    ORDER BY created_at DESC LIMIT 1
)
SELECT
    c.in_sum - c.out_sum AS confirmed_net_profit_recomputed,
    e.total_sell_amount - e.total_buy_amount - e.total_cost - e.total_share AS expected_net_profit_recomputed,
    CASE
        WHEN (c.in_sum - c.out_sum) = (e.total_sell_amount - e.total_buy_amount - e.total_cost - e.total_share)
        THEN 'EQUAL_BY_COINCIDENCE (정상 - 모든 셰어가 실지급된 케이스 특성)'
        ELSE 'DIFFERENT (정상 - 일반적인 케이스)'
    END AS path_independence_note
FROM confirmed_path c, expected_path e;

-- 두 결과값이 같더라도(700,000=700,000), 계산에 사용된 원본 데이터 출처
-- (formula_payment_records vs formula_calculation_snapshots)가 다르다는 것이
-- 이 쿼리로 증명된다. 즉 "같은 값"이 "같은 계산 경로"를 의미하지 않는다.


\echo '=== 6. v_formula_confirmed_kpi ==='
SELECT
    formula_no,
    confirmed_revenue, confirmed_payment,
    scheduled_revenue, scheduled_payment,
    receivable, payable,
    receive_rate, payment_rate
FROM v_formula_confirmed_kpi
WHERE formula_id = '90070000-0000-0000-0003-000000000001';

-- 예상값: confirmed_revenue=2,000,000, confirmed_payment=1,300,000,
--        receivable=0, payable=0, receive_rate=100.00, payment_rate=100.00


\echo '=== 7. v_participant_confirmed_kpi ==='
SELECT
    company_name, role_group, sequence_order,
    total_buy_amount, total_sell_amount,
    confirmed_in, confirmed_out,
    scheduled_in, scheduled_out,
    receivable, payable, confirmed_net_profit
FROM v_participant_confirmed_kpi
WHERE formula_id = '90070000-0000-0000-0003-000000000001'
ORDER BY sequence_order;

-- 예상값:
--   Supplier Share Co : 전부 0
--   GioWorks Share    : total_buy_amount=1,000,000, total_sell_amount=2,000,000,
--                       confirmed_in=2,000,000, confirmed_out=1,300,000,
--                       scheduled_in=2,000,000, scheduled_out=1,300,000,
--                       receivable=0, payable=0, confirmed_net_profit=700,000
--   Buyer Share Co    : 전부 0


\echo '=== 8. Share 지급 payment_records 확인 ==='
SELECT
    r.id, r.direction, r.actual_amount, r.status, r.is_canceled,
    cp.company_name AS counterparty,
    s.payment_type
FROM formula_payment_records r
JOIN companies cp ON cp.id = r.counterparty_company_id
JOIN formula_payment_schedules s ON s.id = r.payment_schedule_id
WHERE r.formula_id = '90070000-0000-0000-0003-000000000001'
  AND cp.company_name IN ('Share Partner A', 'Share Partner B')
ORDER BY cp.company_name;

-- 예상값: 2건. Share Partner A=200,000, Share Partner B=100,000, 둘 다 COMPLETED, is_canceled=FALSE


\echo '=== 9. expected_share 계산 확인 (gross profit 10% 역산) ==='
SELECT
    p.expected_buy, p.expected_revenue,
    (p.expected_revenue - p.expected_buy) AS gross_profit,
    ROUND((p.expected_revenue - p.expected_buy) * 0.10, 2) AS computed_share_b,
    fs_b.share_amount AS stored_share_b,
    CASE WHEN ROUND((p.expected_revenue - p.expected_buy) * 0.10, 2) = fs_b.share_amount
         THEN 'PASS' ELSE 'FAIL' END AS share_b_rate_check
FROM v_formula_profit_engine p
JOIN formula_shares fs_b ON fs_b.formula_id = p.formula_id AND fs_b.share_method = 'RATE'
WHERE p.formula_id = '90070000-0000-0000-0003-000000000001';

-- 예상값: gross_profit=1,000,000, computed_share_b=100,000, stored_share_b=100,000, PASS


\echo '=== 10. Expected vs Actual 종합 비교 (PASS/FAIL 자동 판정) ==='
WITH expected(metric, expected_value) AS (
    VALUES
        ('confirmed_revenue',     2000000::numeric),
        ('confirmed_payment',     1300000::numeric),
        ('confirmed_net_profit',   700000::numeric),
        ('expected_revenue',     2000000::numeric),
        ('expected_buy',         1000000::numeric),
        ('expected_cost',               0::numeric),
        ('expected_share',         300000::numeric),
        ('expected_net_profit',   700000::numeric),
        ('receivable',                  0::numeric),
        ('payable',                     0::numeric),
        ('receive_rate',           100.00::numeric),
        ('payment_rate',           100.00::numeric)
),
kpi AS (
    SELECT * FROM v_formula_confirmed_kpi
    WHERE formula_id = '90070000-0000-0000-0003-000000000001'
),
profit AS (
    SELECT * FROM v_formula_profit_engine
    WHERE formula_id = '90070000-0000-0000-0003-000000000001'
),
actual AS (
    SELECT 'confirmed_revenue'    AS metric, k.confirmed_revenue    AS actual_value FROM kpi k UNION ALL
    SELECT 'confirmed_payment',           k.confirmed_payment        FROM kpi k UNION ALL
    SELECT 'receivable',                  k.receivable               FROM kpi k UNION ALL
    SELECT 'payable',                     k.payable                  FROM kpi k UNION ALL
    SELECT 'receive_rate',                k.receive_rate             FROM kpi k UNION ALL
    SELECT 'payment_rate',                k.payment_rate             FROM kpi k UNION ALL
    SELECT 'confirmed_net_profit',        p.confirmed_net_profit     FROM profit p UNION ALL
    SELECT 'expected_revenue',            p.expected_revenue         FROM profit p UNION ALL
    SELECT 'expected_buy',                p.expected_buy              FROM profit p UNION ALL
    SELECT 'expected_cost',               p.expected_cost            FROM profit p UNION ALL
    SELECT 'expected_share',              p.expected_share           FROM profit p UNION ALL
    SELECT 'expected_net_profit',         p.expected_net_profit      FROM profit p
)
SELECT
    e.metric, e.expected_value, a.actual_value,
    CASE WHEN e.expected_value = a.actual_value THEN 'PASS' ELSE 'FAIL' END AS result
FROM expected e
JOIN actual a ON a.metric = e.metric
ORDER BY e.metric;

-- 12개 행 전부 result='PASS'가 나와야 정상.


\echo '=== 11. can_close FALSE 단독 재확인 ==='
SELECT
    CASE WHEN can_close = FALSE THEN 'PASS' ELSE 'FAIL' END AS can_close_check
FROM v_formula_closeable
WHERE formula_id = '90070000-0000-0000-0003-000000000001';
