-- =============================================================================
-- TOCS TEST-006 View 검증 SQL — Formula 종결(CLOSE) 검증
-- =============================================================================
-- 전제: base + supplement + amount_verified fix + TEST-001~005 + TEST-006 seed
--       순서대로 적용 완료된 상태
--
-- formula_id (TEST-006) = '90060000-0000-0000-0003-000000000001'
-- =============================================================================

\echo '=== 1. formulas 직접 확인 (6개 상태 + is_closed + closed_at) ==='
SELECT
    formula_no,
    trade_status, delivery_status, cash_in_status, cash_out_status,
    invoice_status, logistics_status,
    is_closed, closed_at
FROM formulas
WHERE id = '90060000-0000-0000-0003-000000000001';

-- 예상값: 6개 상태 전부 COMPLETED(또는 invoice_status=AMOUNT_MATCHED),
--        is_closed=TRUE, closed_at IS NOT NULL


\echo '=== 2. v_formula_closeable ==='
SELECT
    formula_no,
    trade_done, delivery_done, cash_in_done, cash_out_done,
    invoice_done, logistics_done, can_close, is_closed
FROM v_formula_closeable
WHERE formula_id = '90060000-0000-0000-0003-000000000001';

-- 예상값: 6개 _done 컬럼 전부 TRUE, can_close=TRUE, is_closed=TRUE


\echo '=== 3. v_formula_confirmed_kpi ==='
SELECT
    formula_no,
    confirmed_revenue, confirmed_payment,
    scheduled_revenue, scheduled_payment,
    receivable, payable,
    receive_rate, payment_rate
FROM v_formula_confirmed_kpi
WHERE formula_id = '90060000-0000-0000-0003-000000000001';

-- 예상값: confirmed_revenue=1,500,000, confirmed_payment=1,000,000,
--        receivable=0, payable=0, receive_rate=100.00, payment_rate=100.00


\echo '=== 4. v_formula_profit_engine ==='
SELECT
    formula_no,
    confirmed_net_profit,
    expected_revenue, expected_buy, expected_cost, expected_share, expected_net_profit
FROM v_formula_profit_engine
WHERE formula_id = '90060000-0000-0000-0003-000000000001';

-- 예상값: confirmed_net_profit=500,000, expected_net_profit=500,000
-- 주의: 이번 케이스는 비용/셰어가 0이라 두 값이 "우연히" 같다.
--      이것은 확정/예상 KPI 혼합 버그가 아니라 케이스 특성이다.
--      (혼합 여부는 계산 경로가 독립적인지로 판단해야 하며, 결과값 동일 여부만으로 판단하지 않음)


\echo '=== 5. v_formula_invoice_status ==='
SELECT
    formula_no, active_count, matched_count, mismatched_count,
    in_progress_count, derived_invoice_status
FROM v_formula_invoice_status
WHERE formula_id = '90060000-0000-0000-0003-000000000001';

-- 예상값: active_count=2, matched_count=2, mismatched_count=0,
--        in_progress_count=0, derived_invoice_status='AMOUNT_MATCHED'


\echo '=== 6. formula_invoices amount_verified 확인 ==='
SELECT
    invoice_no, sequence_order,
    external_invoice_amount, supply_amount, tax_amount, total_amount,
    amount_verified, status
FROM formula_invoices
WHERE formula_id = '90060000-0000-0000-0003-000000000001'
ORDER BY sequence_order;

-- 예상값: 2건 모두 amount_verified=TRUE (external_invoice_amount = total_amount 정확히 일치)
--        status는 둘 다 'AMOUNT_MATCHED' (Seed가 직접 명시한 값, formulas.invoice_status와는 별개 컬럼)


\echo '=== 7. formula_logistics 확인 ==='
SELECT
    carrier.company_name AS carrier_company,
    departure.company_name AS departure_company,
    arrival.company_name AS arrival_company,
    cost_bearer.company_name AS cost_bearer_company,
    fl.cost_type, fl.total_logistics_cost
FROM formula_logistics fl
JOIN companies carrier     ON carrier.id     = fl.carrier_company_id
JOIN companies departure   ON departure.id   = fl.departure_company_id
JOIN companies arrival     ON arrival.id     = fl.arrival_company_id
JOIN companies cost_bearer ON cost_bearer.id = fl.cost_bearer_company_id
WHERE fl.formula_id = '90060000-0000-0000-0003-000000000001';

-- 예상값: cost_type='INCLUDED_IN_SELL_PRICE', total_logistics_cost=0


\echo '=== 8. formula_status_logs 확인 (6개 상태 전환 이력) ==='
SELECT status_target, prev_status, new_status, changed_by
FROM formula_status_logs
WHERE formula_id = '90060000-0000-0000-0003-000000000001'
ORDER BY status_target;

-- 예상값: 6개 행, 각 status_target마다 1건씩


\echo '=== 9. audit_logs 확인 (종결 처리 감사 기록) ==='
SELECT table_name, record_id, action, changed_by, old_data, new_data
FROM audit_logs
WHERE record_id = '90060000-0000-0000-0003-000000000001'
  AND table_name = 'formulas';

-- 예상값: 1건, action='STATUS_CHANGE'


\echo '=== 10. Expected vs Actual 종합 비교 (PASS/FAIL 자동 판정) ==='
WITH expected(metric, expected_value) AS (
    VALUES
        ('confirmed_revenue',     1500000::numeric),
        ('confirmed_payment',     1000000::numeric),
        ('confirmed_net_profit',   500000::numeric),
        ('expected_revenue',     1500000::numeric),
        ('expected_buy',         1000000::numeric),
        ('expected_cost',               0::numeric),
        ('expected_share',              0::numeric),
        ('expected_net_profit',   500000::numeric),
        ('receivable',                  0::numeric),
        ('payable',                     0::numeric),
        ('receive_rate',           100.00::numeric),
        ('payment_rate',           100.00::numeric)
),
kpi AS (
    SELECT * FROM v_formula_confirmed_kpi
    WHERE formula_id = '90060000-0000-0000-0003-000000000001'
),
profit AS (
    SELECT * FROM v_formula_profit_engine
    WHERE formula_id = '90060000-0000-0000-0003-000000000001'
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


\echo '=== 11. can_close / is_closed / closed_at 단독 재확인 (이번 테스트의 핵심) ==='
SELECT
    CASE WHEN can_close = TRUE  THEN 'PASS' ELSE 'FAIL' END AS can_close_check,
    CASE WHEN is_closed = TRUE  THEN 'PASS' ELSE 'FAIL' END AS is_closed_check
FROM v_formula_closeable
WHERE formula_id = '90060000-0000-0000-0003-000000000001';

SELECT
    CASE WHEN closed_at IS NOT NULL THEN 'PASS' ELSE 'FAIL' END AS closed_at_not_null_check
FROM formulas
WHERE id = '90060000-0000-0000-0003-000000000001';


\echo '=== 12. amount_verified 2건 전부 TRUE 단독 확인 ==='
SELECT
    CASE WHEN COUNT(*) = 2 AND BOOL_AND(amount_verified) THEN 'PASS' ELSE 'FAIL' END AS amount_verified_check
FROM formula_invoices
WHERE formula_id = '90060000-0000-0000-0003-000000000001';
