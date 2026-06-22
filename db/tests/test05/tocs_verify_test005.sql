-- =============================================================================
-- TOCS TEST-005 View 검증 SQL — 물류비/운송사/운송비 부담주체 검증
-- =============================================================================
-- 전제: base + supplement + amount_verified fix + TEST-001~004 + TEST-005 seed
--       순서대로 적용 완료된 상태
--
-- formula_id (TEST-005) = '90050000-0000-0000-0003-000000000001'
-- participant_id(GioWorks Logistics) = '90050000-0000-0000-0004-000000000002'
-- =============================================================================

\echo '=== 1. formula_logistics 직접 확인 (4주체 분리) ==='
SELECT
    carrier.company_name  AS carrier_company,
    departure.company_name AS departure_company,
    arrival.company_name  AS arrival_company,
    cost_bearer.company_name AS cost_bearer_company,
    fl.cost_type,
    fl.total_logistics_cost
FROM formula_logistics fl
JOIN companies carrier      ON carrier.id      = fl.carrier_company_id
JOIN companies departure    ON departure.id    = fl.departure_company_id
JOIN companies arrival      ON arrival.id      = fl.arrival_company_id
JOIN companies cost_bearer  ON cost_bearer.id  = fl.cost_bearer_company_id
WHERE fl.formula_id = '90050000-0000-0000-0003-000000000001';

-- 예상값:
--   carrier_company      = Carrier Logistics Co
--   departure_company    = Supplier Logistics Co
--   arrival_company      = Buyer Logistics Co
--   cost_bearer_company  = GioWorks Logistics
--   cost_type            = SEPARATE_COST
--   total_logistics_cost = 300,000


\echo '=== 2. v_formula_confirmed_kpi ==='
SELECT
    formula_no,
    cash_in_status, cash_out_status,
    confirmed_revenue, confirmed_payment,
    scheduled_revenue, scheduled_payment,
    receivable, payable,
    receive_rate, payment_rate
FROM v_formula_confirmed_kpi
WHERE formula_id = '90050000-0000-0000-0003-000000000001';

-- 예상값:
--   confirmed_revenue = 3,600,000   confirmed_payment = 2,300,000  (매입2,000,000+운송비300,000)
--   scheduled_revenue = 3,600,000   scheduled_payment = 2,300,000
--   receivable = 0                  payable = 0
--   receive_rate = 100.00            payment_rate = 100.00


\echo '=== 3. v_formula_profit_engine (확정순이익 vs 예상순이익) ==='
SELECT
    formula_no,
    confirmed_revenue, confirmed_cost_total, confirmed_net_profit,
    expected_revenue, expected_buy, expected_cost, expected_share,
    expected_net_profit, expected_profit_rate
FROM v_formula_profit_engine
WHERE formula_id = '90050000-0000-0000-0003-000000000001';

-- 예상값:
--   confirmed_net_profit = 1,300,000  (실입금3,600,000 - 실출금2,300,000[매입+운송비])
--   expected_net_profit  = 1,200,000  (3,600,000-2,000,000-300,000[운송비]-100,000[셰어])
--   주의: 운송비 300,000이 양쪽 계산에 모두 들어가지만 경로가 다르다.
--        확정순이익: 실출금(매입대금+운송비 record) 차감
--        예상순이익: expected_cost(snapshot의 total_cost) 차감
--        두 값(1,300,000 vs 1,200,000)은 반드시 달라야 정상.


\echo '=== 4. v_formula_closeable ==='
SELECT
    formula_no,
    trade_done, delivery_done, cash_in_done, cash_out_done,
    invoice_done, logistics_done, can_close, is_closed
FROM v_formula_closeable
WHERE formula_id = '90050000-0000-0000-0003-000000000001';

-- 예상값: can_close = FALSE
-- logistics_done = FALSE (logistics_status = IN_PROGRESS, COMPLETED 아님) -- 핵심 검증 포인트
-- invoice_done, trade_done, delivery_done도 FALSE


\echo '=== 5. v_participant_confirmed_kpi ==='
SELECT
    company_name, role_group, sequence_order,
    total_buy_amount, total_sell_amount,
    confirmed_in, confirmed_out,
    scheduled_in, scheduled_out,
    receivable, payable, confirmed_net_profit
FROM v_participant_confirmed_kpi
WHERE formula_id = '90050000-0000-0000-0003-000000000001'
ORDER BY sequence_order;

-- 예상값:
--   Supplier Logistics Co : 전부 0
--   GioWorks Logistics    : total_buy_amount=2,000,000, total_sell_amount=3,600,000,
--                           confirmed_in=3,600,000, confirmed_out=2,300,000,
--                           scheduled_in=3,600,000, scheduled_out=2,300,000,
--                           receivable=0, payable=0, confirmed_net_profit=1,300,000
--   Buyer Logistics Co    : 전부 0


\echo '=== 6. 운송비 지급 record 직접 확인 ==='
SELECT
    r.id, r.direction, r.actual_amount, r.status, r.is_canceled,
    cp.company_name AS counterparty,
    s.payment_type
FROM formula_payment_records r
JOIN companies cp ON cp.id = r.counterparty_company_id
JOIN formula_payment_schedules s ON s.id = r.payment_schedule_id
WHERE r.formula_id = '90050000-0000-0000-0003-000000000001'
  AND cp.company_name = 'Carrier Logistics Co';

-- 예상값: 1건. direction=OUT, actual_amount=300,000, status=COMPLETED, is_canceled=FALSE,
--        counterparty=Carrier Logistics Co, payment_type=POST_SETTLEMENT


\echo '=== 7. Expected vs Actual 종합 비교 (PASS/FAIL 자동 판정) ==='
WITH expected(metric, expected_value) AS (
    VALUES
        ('expected_revenue',      3600000::numeric),
        ('expected_buy',          2000000::numeric),
        ('expected_cost',          300000::numeric),
        ('expected_share',         100000::numeric),
        ('expected_net_profit',  1200000::numeric),
        ('confirmed_revenue',    3600000::numeric),
        ('confirmed_payment',    2300000::numeric),
        ('confirmed_net_profit', 1300000::numeric),
        ('receivable',                 0::numeric),
        ('payable',                    0::numeric),
        ('receive_rate',          100.00::numeric),
        ('payment_rate',          100.00::numeric)
),
kpi AS (
    SELECT * FROM v_formula_confirmed_kpi
    WHERE formula_id = '90050000-0000-0000-0003-000000000001'
),
profit AS (
    SELECT * FROM v_formula_profit_engine
    WHERE formula_id = '90050000-0000-0000-0003-000000000001'
),
actual AS (
    SELECT 'expected_revenue'      AS metric, p.expected_revenue      AS actual_value FROM profit p UNION ALL
    SELECT 'expected_buy',                 p.expected_buy             FROM profit p UNION ALL
    SELECT 'expected_cost',                p.expected_cost            FROM profit p UNION ALL
    SELECT 'expected_share',               p.expected_share           FROM profit p UNION ALL
    SELECT 'expected_net_profit',          p.expected_net_profit      FROM profit p UNION ALL
    SELECT 'confirmed_net_profit',         p.confirmed_net_profit     FROM profit p UNION ALL
    SELECT 'confirmed_revenue',            k.confirmed_revenue        FROM kpi k UNION ALL
    SELECT 'confirmed_payment',            k.confirmed_payment        FROM kpi k UNION ALL
    SELECT 'receivable',                   k.receivable               FROM kpi k UNION ALL
    SELECT 'payable',                      k.payable                  FROM kpi k UNION ALL
    SELECT 'receive_rate',                 k.receive_rate             FROM kpi k UNION ALL
    SELECT 'payment_rate',                 k.payment_rate             FROM kpi k
)
SELECT
    e.metric,
    e.expected_value,
    a.actual_value,
    CASE WHEN e.expected_value = a.actual_value THEN 'PASS' ELSE 'FAIL' END AS result
FROM expected e
JOIN actual a ON a.metric = e.metric
ORDER BY e.metric;

-- 12개 행 전부 result='PASS'가 나와야 정상.


\echo '=== 8. 운송비가 실출금에 반영되어 confirmed_payment가 늘어났는지 단독 확인 ==='
-- 운송비(300,000) record를 제외했을 때의 가상 confirmed_payment와 실제 값을 비교하여
-- 운송비가 실제로 합산에 포함됐는지 직접 검증한다.
WITH without_logistics AS (
    SELECT SUM(actual_amount) AS payment_excl_logistics
    FROM formula_payment_records
    WHERE formula_id = '90050000-0000-0000-0003-000000000001'
      AND direction = 'OUT' AND status = 'COMPLETED' AND NOT is_canceled
      AND counterparty_company_id != '90050000-0000-0000-0001-000000000004'  -- Carrier 제외
)
SELECT
    k.confirmed_payment AS actual_confirmed_payment,
    w.payment_excl_logistics AS payment_excluding_logistics,
    k.confirmed_payment - w.payment_excl_logistics AS logistics_contribution,
    CASE WHEN k.confirmed_payment - w.payment_excl_logistics = 300000
         THEN 'PASS' ELSE 'FAIL' END AS logistics_reflected_check
FROM v_formula_confirmed_kpi k, without_logistics w
WHERE k.formula_id = '90050000-0000-0000-0003-000000000001';

-- logistics_contribution = 300,000 이어야 정상 (운송비가 confirmed_payment에 정확히 반영됨)


\echo '=== 9. expected_cost(300,000)가 운송비와 일치하는지 단독 확인 ==='
SELECT
    fl.total_logistics_cost,
    p.expected_cost,
    CASE WHEN fl.total_logistics_cost = p.expected_cost THEN 'PASS' ELSE 'FAIL' END AS cost_match_check
FROM formula_logistics fl
JOIN v_formula_profit_engine p ON p.formula_id = fl.formula_id
WHERE fl.formula_id = '90050000-0000-0000-0003-000000000001';


\echo '=== 10. 확정순이익 != 예상순이익 회귀 방지 체크 ==='
SELECT
    confirmed_net_profit, expected_net_profit,
    CASE WHEN confirmed_net_profit != expected_net_profit THEN 'PASS' ELSE 'FAIL' END AS mix_check
FROM v_formula_profit_engine
WHERE formula_id = '90050000-0000-0000-0003-000000000001';


\echo '=== 11. can_close FALSE 단독 재확인 (logistics_done=FALSE가 원인인지 포함) ==='
SELECT
    logistics_done,
    can_close,
    CASE WHEN can_close = FALSE THEN 'PASS' ELSE 'FAIL' END AS can_close_check,
    CASE WHEN logistics_done = FALSE THEN 'PASS' ELSE 'FAIL' END AS logistics_done_check
FROM v_formula_closeable
WHERE formula_id = '90050000-0000-0000-0003-000000000001';
