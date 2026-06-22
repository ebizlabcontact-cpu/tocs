-- =============================================================================
-- TOCS TEST-003 View 검증 SQL — 외상거래(Credit) 검증
-- =============================================================================
-- 전제: base + supplement + amount_verified fix + TEST-001 + TEST-002 + TEST-003 seed
--       순서대로 적용 완료된 상태
--
-- formula_id (TEST-003) = '90030000-0000-0000-0003-000000000001'
-- participant_id(GioWorks Credit) = '90030000-0000-0000-0004-000000000002'
--
-- 핵심 검증: record가 0건인 상태에서 confirmed 계열은 전부 0,
--           scheduled 계열은 예정금액 그대로, can_close=FALSE.
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
WHERE formula_id = '90030000-0000-0000-0003-000000000001';

-- 예상값:
--   confirmed_revenue = 0          confirmed_payment = 0
--   scheduled_revenue = 3,250,000  scheduled_payment = 2,000,000
--   receivable        = 3,250,000  payable           = 2,000,000
--   receive_rate       = 0.00       payment_rate       = 0.00
--   (주의: scheduled가 0이 아니므로 NULL이 아니라 0.00이 정상값. NULL이 나오면 오류.)


\echo '=== 2. v_formula_profit_engine ==='
SELECT
    formula_no,
    confirmed_revenue, confirmed_cost_total, confirmed_net_profit,
    expected_revenue, expected_buy, expected_cost, expected_share,
    expected_net_profit, expected_profit_rate
FROM v_formula_profit_engine
WHERE formula_id = '90030000-0000-0000-0003-000000000001';

-- 예상값:
--   confirmed_net_profit = 0         (record 0건이므로 실입금-실출금 = 0-0 = 0)
--   expected_net_profit  = 1,100,000 (snapshot 기준: 3,250,000-2,000,000-100,000-50,000)
--   주의: 확정순이익(0)과 예상순이익(1,100,000)은 반드시 다르게 나와야 정상.
--        같게 나오면 확정/예상이 잘못 혼합된 것.


\echo '=== 3. v_formula_closeable ==='
SELECT
    formula_no,
    trade_done, delivery_done, cash_in_done, cash_out_done,
    invoice_done, logistics_done, can_close, is_closed
FROM v_formula_closeable
WHERE formula_id = '90030000-0000-0000-0003-000000000001';

-- 예상값: can_close = FALSE (cash_in_status=PENDING, cash_out_status=PENDING 등 전부 미완료)


\echo '=== 4. v_participant_confirmed_kpi ==='
SELECT
    company_name, role_group, sequence_order,
    total_buy_amount, total_sell_amount,
    confirmed_in, confirmed_out,
    scheduled_in, scheduled_out,
    receivable, payable, confirmed_net_profit
FROM v_participant_confirmed_kpi
WHERE formula_id = '90030000-0000-0000-0003-000000000001'
ORDER BY sequence_order;

-- 예상값:
--   Supplier Credit Co : 전부 0 (schedule/record의 participant_id가 아님)
--   GioWorks Credit    : total_buy_amount=2,000,000, total_sell_amount=3,250,000,
--                        confirmed_in=0, confirmed_out=0,
--                        scheduled_in=3,250,000, scheduled_out=2,000,000,
--                        receivable=3,250,000, payable=2,000,000,
--                        confirmed_net_profit=0
--   Buyer Credit Co    : 전부 0


\echo '=== 5. v_payment_unmatched (TEST-003 한정) ==='
SELECT id, formula_no, direction, actual_amount, actual_date, bank_name, account_no, status, memo
FROM v_payment_unmatched
WHERE formula_id = '90030000-0000-0000-0003-000000000001';

-- 예상값: 0 rows
-- (record 자체가 없으므로 미매칭 레코드도 당연히 없음 - "없는 것이 정상"이라는 점에 주의)


\echo '=== 6. formula_payment_records 직접 확인 (0건이어야 함) ==='
SELECT COUNT(*) AS record_count
FROM formula_payment_records
WHERE formula_id = '90030000-0000-0000-0003-000000000001';

-- 예상값: 0


\echo '=== 7. formula_payment_schedules 직접 확인 (2건이어야 함) ==='
SELECT direction, payment_type, scheduled_amount, status
FROM formula_payment_schedules
WHERE formula_id = '90030000-0000-0000-0003-000000000001'
ORDER BY direction;

-- 예상값: IN 3,250,000 PENDING / OUT 2,000,000 PENDING


\echo '=== 8. Expected vs Actual 종합 비교 (PASS/FAIL 자동 판정) ==='
WITH expected(metric, expected_value) AS (
    VALUES
        ('confirmed_revenue',     0::numeric),
        ('confirmed_payment',     0::numeric),
        ('confirmed_net_profit',  0::numeric),
        ('scheduled_revenue',     3250000::numeric),
        ('scheduled_payment',     2000000::numeric),
        ('receivable',            3250000::numeric),
        ('payable',               2000000::numeric),
        ('receive_rate',          0.00::numeric),
        ('payment_rate',          0.00::numeric),
        ('expected_net_profit',   1100000::numeric)
),
kpi AS (
    SELECT * FROM v_formula_confirmed_kpi
    WHERE formula_id = '90030000-0000-0000-0003-000000000001'
),
profit AS (
    SELECT * FROM v_formula_profit_engine
    WHERE formula_id = '90030000-0000-0000-0003-000000000001'
),
actual AS (
    SELECT 'confirmed_revenue'    AS metric, k.confirmed_revenue    AS actual_value FROM kpi k UNION ALL
    SELECT 'confirmed_payment',           k.confirmed_payment        FROM kpi k UNION ALL
    SELECT 'scheduled_revenue',           k.scheduled_revenue        FROM kpi k UNION ALL
    SELECT 'scheduled_payment',           k.scheduled_payment        FROM kpi k UNION ALL
    SELECT 'receivable',                  k.receivable               FROM kpi k UNION ALL
    SELECT 'payable',                     k.payable                  FROM kpi k UNION ALL
    SELECT 'receive_rate',                k.receive_rate             FROM kpi k UNION ALL
    SELECT 'payment_rate',                k.payment_rate             FROM kpi k UNION ALL
    SELECT 'confirmed_net_profit',        p.confirmed_net_profit     FROM profit p UNION ALL
    SELECT 'expected_net_profit',         p.expected_net_profit      FROM profit p
)
SELECT
    e.metric,
    e.expected_value,
    a.actual_value,
    CASE WHEN e.expected_value = a.actual_value THEN 'PASS' ELSE 'FAIL' END AS result
FROM expected e
JOIN actual a ON a.metric = e.metric
ORDER BY e.metric;

-- 10개 행 전부 result='PASS'가 나와야 정상.


\echo '=== 9. can_close FALSE 단독 재확인 ==='
SELECT
    CASE WHEN can_close = FALSE THEN 'PASS' ELSE 'FAIL' END AS can_close_check
FROM v_formula_closeable
WHERE formula_id = '90030000-0000-0000-0003-000000000001';


\echo '=== 10. receive_rate/payment_rate가 NULL이 아니라 정확히 0인지 별도 확인 ==='
-- View의 CASE 분기상 scheduled가 0일 때만 NULL이 나오는데, 이번 케이스는 scheduled가
-- 0이 아니므로(3,250,000 / 2,000,000) 반드시 0.00이 나와야 한다. NULL이면 FAIL.
SELECT
    CASE WHEN receive_rate IS NOT NULL AND receive_rate = 0.00 THEN 'PASS' ELSE 'FAIL' END AS receive_rate_check,
    CASE WHEN payment_rate IS NOT NULL AND payment_rate = 0.00 THEN 'PASS' ELSE 'FAIL' END AS payment_rate_check
FROM v_formula_confirmed_kpi
WHERE formula_id = '90030000-0000-0000-0003-000000000001';
