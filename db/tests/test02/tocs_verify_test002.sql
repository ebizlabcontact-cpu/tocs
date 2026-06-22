-- =============================================================================
-- TOCS TEST-002 View 검증 SQL — Payment Engine 예외 검증
-- =============================================================================
-- 전제: base schema + supplement + amount_verified fix + TEST-001 seed
--       + TEST-002 seed 순서대로 적용 완료된 상태
--
-- formula_id (TEST-002) = 'ffffffff-ffff-ffff-ffff-ffffffffff01'
-- participant_id(GioWorks) = '00000000-0000-0000-0001-000000000002'
--
-- 검증 항목:
--   1. v_formula_confirmed_kpi
--   2. v_participant_confirmed_kpi
--   3. v_payment_unmatched (TEST-002에는 미매칭 레코드가 없어야 함 - 결과 0건이 정답)
--   4. is_canceled record 목록 (집계 제외 확인)
--   5. expected vs actual 비교 (PASS/FAIL 자동 판정)
-- =============================================================================

\echo '=== 1. v_formula_confirmed_kpi ==='
SELECT
    formula_no,
    cash_in_status, cash_out_status,
    confirmed_revenue, confirmed_payment,
    scheduled_revenue, scheduled_payment,
    receivable, payable,
    receive_rate, payment_rate
FROM v_formula_confirmed_kpi
WHERE formula_id = 'ffffffff-ffff-ffff-ffff-ffffffffff01';

-- 예상값:
--   confirmed_revenue = 6,500,000   confirmed_payment = 3,000,000
--   scheduled_revenue = 8,000,000   scheduled_payment = 5,000,000
--   receivable        = 1,500,000   payable           = 2,000,000
--   receive_rate       = 81.25       payment_rate       = 60.00


\echo '=== 2. v_formula_profit_engine (확정순이익 vs 예상순이익 비교) ==='
SELECT
    formula_no,
    confirmed_revenue, confirmed_cost_total, confirmed_net_profit,
    expected_revenue, expected_buy, expected_cost, expected_share,
    expected_net_profit, expected_profit_rate
FROM v_formula_profit_engine
WHERE formula_id = 'ffffffff-ffff-ffff-ffff-ffffffffff01';

-- 예상값:
--   confirmed_net_profit = 3,500,000  (실입금 6,500,000 - 실출금 3,000,000)
--   expected_net_profit  = 2,500,000  (총매출8,000,000-총매입5,000,000-비용300,000-셰어200,000)
--   주의: 두 값은 서로 다른 것이 정상 (확정 vs 예상은 혼합하지 않음 원칙)


\echo '=== 3. v_formula_closeable ==='
SELECT
    formula_no,
    trade_done, delivery_done, cash_in_done, cash_out_done,
    invoice_done, logistics_done, can_close, is_closed
FROM v_formula_closeable
WHERE formula_id = 'ffffffff-ffff-ffff-ffff-ffffffffff01';

-- 예상값: can_close = FALSE (cash_in/cash_out 모두 미완료이므로)


\echo '=== 4. v_participant_confirmed_kpi ==='
SELECT
    company_name, role_group, sequence_order,
    total_buy_amount, total_sell_amount,
    confirmed_in, confirmed_out,
    scheduled_in, scheduled_out,
    receivable, payable, confirmed_net_profit
FROM v_participant_confirmed_kpi
WHERE formula_id = 'ffffffff-ffff-ffff-ffff-ffffffffff01'
ORDER BY sequence_order;

-- 예상값 (GioWorks 행만 0이 아닌 값을 가짐 - 모든 schedule/record의 participant_id가 GioWorks이므로):
--   Supplier A : 전부 0
--   GioWorks   : confirmed_in=6,500,000, confirmed_out=3,000,000,
--                scheduled_in=8,000,000, scheduled_out=5,000,000,
--                receivable=1,500,000, payable=2,000,000,
--                confirmed_net_profit=3,500,000
--   Buyer B    : 전부 0


\echo '=== 5. v_payment_unmatched (TEST-002 한정) ==='
SELECT id, formula_no, direction, actual_amount, actual_date, bank_name, account_no, status, memo
FROM v_payment_unmatched
WHERE formula_id = 'ffffffff-ffff-ffff-ffff-ffffffffff01';

-- 예상값: 0 rows
-- (TEST-002의 모든 record는 payment_schedule_id를 명시했으므로 미매칭 레코드 없음)


\echo '=== 6. is_canceled record 목록 (집계 제외 확인용) ==='
SELECT
    id, direction, actual_amount, status, is_canceled, canceled_at, cancel_reason
FROM formula_payment_records
WHERE formula_id = 'ffffffff-ffff-ffff-ffff-ffffffffff01'
ORDER BY actual_date;

-- 예상값: 7개 행이 아니라 6개 행 (3차 1,000,000은 INSERT 1건 + UPDATE로 취소된 것이므로 행 자체는 1개)
--   3차 레코드(1,000,000)만 is_canceled=TRUE, 나머지 5건은 FALSE


\echo '=== 7. is_canceled=TRUE 레코드가 실제로 KPI에서 제외되었는지 직접 대조 ==='
WITH all_in AS (
    SELECT SUM(actual_amount) AS total_all
    FROM formula_payment_records
    WHERE formula_id = 'ffffffff-ffff-ffff-ffff-ffffffffff01'
      AND direction = 'IN' AND status = 'COMPLETED'
),
valid_in AS (
    SELECT SUM(actual_amount) AS total_valid
    FROM formula_payment_records
    WHERE formula_id = 'ffffffff-ffff-ffff-ffff-ffffffffff01'
      AND direction = 'IN' AND status = 'COMPLETED' AND NOT is_canceled
)
SELECT
    a.total_all   AS "취소포함_전체합(7,500,000_예상)",
    v.total_valid AS "취소제외_유효합(6,500,000_예상)",
    a.total_all - v.total_valid AS "차이_취소금액(1,000,000_이어야_함)"
FROM all_in a, valid_in v;


\echo '=== 8. Expected vs Actual 종합 비교 (PASS/FAIL 자동 판정) ==='
WITH expected(metric, expected_value) AS (
    VALUES
        ('confirmed_revenue', 6500000::numeric),
        ('confirmed_payment', 3000000::numeric),
        ('scheduled_revenue', 8000000::numeric),
        ('scheduled_payment', 5000000::numeric),
        ('receivable',        1500000::numeric),
        ('payable',           2000000::numeric),
        ('receive_rate',        81.25::numeric),
        ('payment_rate',        60.00::numeric),
        ('confirmed_net_profit',3500000::numeric)
),
actual AS (
    SELECT
        unnest(ARRAY[
            'confirmed_revenue','confirmed_payment','scheduled_revenue','scheduled_payment',
            'receivable','payable','receive_rate','payment_rate'
        ]) AS metric,
        unnest(ARRAY[
            k.confirmed_revenue, k.confirmed_payment, k.scheduled_revenue, k.scheduled_payment,
            k.receivable, k.payable, k.receive_rate, k.payment_rate
        ]) AS actual_value
    FROM v_formula_confirmed_kpi k
    WHERE k.formula_id = 'ffffffff-ffff-ffff-ffff-ffffffffff01'

    UNION ALL

    SELECT 'confirmed_net_profit', p.confirmed_net_profit
    FROM v_formula_profit_engine p
    WHERE p.formula_id = 'ffffffff-ffff-ffff-ffff-ffffffffff01'
)
SELECT
    e.metric,
    e.expected_value,
    a.actual_value,
    CASE WHEN e.expected_value = a.actual_value THEN 'PASS' ELSE 'FAIL' END AS result
FROM expected e
JOIN actual a ON a.metric = e.metric
ORDER BY e.metric;

-- 9개 행 전부 result='PASS'가 나와야 정상.
-- 하나라도 FAIL이면 해당 metric의 expected_value/actual_value 차이를 비교해서 원인 추적할 것.


\echo '=== 9. can_close FALSE 여부 단독 재확인 ==='
SELECT
    CASE WHEN can_close = FALSE THEN 'PASS' ELSE 'FAIL' END AS can_close_check
FROM v_formula_closeable
WHERE formula_id = 'ffffffff-ffff-ffff-ffff-ffffffffff01';
