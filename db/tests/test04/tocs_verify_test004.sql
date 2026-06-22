-- =============================================================================
-- TOCS TEST-004 View 검증 SQL — 수입/환율 거래(IMPORT) 검증
-- =============================================================================
-- 전제: base + supplement + amount_verified fix + TEST-001~003 + TEST-004 seed
--       순서대로 적용 완료된 상태
--
-- formula_id (TEST-004) = '90040000-0000-0000-0003-000000000001'
-- participant_id(GioWorks Import) = '90040000-0000-0000-0004-000000000002'
-- =============================================================================

\echo '=== 1. formulas 환율 필드 확인 ==='
SELECT
    formula_no, trade_type,
    base_currency, foreign_currency,
    contract_exchange_rate, adjusted_exchange_rate
FROM formulas
WHERE id = '90040000-0000-0000-0003-000000000001';

-- 예상값:
--   trade_type = IMPORT
--   base_currency = KRW, foreign_currency = USD
--   contract_exchange_rate = 1350.000000
--   adjusted_exchange_rate = 1380.000000  (참고값으로 저장만 되고 계산에는 미사용)


\echo '=== 2. formula_participants KRW 환산 단가/금액 확인 ==='
SELECT
    c.company_name, fp.sequence_order,
    fp.buy_unit_price, fp.sell_unit_price,
    fp.total_buy_amount, fp.total_sell_amount,
    fp.memo
FROM formula_participants fp
JOIN companies c ON c.id = fp.company_id
WHERE fp.formula_id = '90040000-0000-0000-0003-000000000001'
ORDER BY fp.sequence_order;

-- 예상값:
--   US Supplier Inc : buy=0,    sell=2700,  total_buy=0,         total_sell=2,700,000
--   GioWorks Import : buy=2700, sell=4000,  total_buy=2,700,000, total_sell=4,000,000
--   Korea Buyer Co  : buy=4000, sell=0,     total_buy=4,000,000, total_sell=0


\echo '=== 3. v_formula_confirmed_kpi ==='
SELECT
    formula_no,
    cash_in_status, cash_out_status,
    confirmed_revenue, confirmed_payment,
    scheduled_revenue, scheduled_payment,
    receivable, payable,
    receive_rate, payment_rate
FROM v_formula_confirmed_kpi
WHERE formula_id = '90040000-0000-0000-0003-000000000001';

-- 예상값:
--   confirmed_revenue = 4,000,000   confirmed_payment = 2,700,000
--   scheduled_revenue = 4,000,000   scheduled_payment = 2,700,000
--   receivable = 0                  payable = 0
--   receive_rate = 100.00            payment_rate = 100.00


\echo '=== 4. v_formula_profit_engine (확정순이익 vs 예상순이익 비교 - 핵심 검증) ==='
SELECT
    formula_no,
    confirmed_revenue, confirmed_cost_total, confirmed_net_profit,
    expected_revenue, expected_buy, expected_cost, expected_share,
    expected_net_profit, expected_profit_rate
FROM v_formula_profit_engine
WHERE formula_id = '90040000-0000-0000-0003-000000000001';

-- 예상값:
--   confirmed_net_profit = 1,300,000  (실입금4,000,000 - 실출금2,700,000)
--   expected_net_profit  = 1,000,000  (4,000,000-2,700,000-200,000-100,000)
--   주의: 두 값은 반드시 서로 달라야 정상 (1,300,000 != 1,000,000).
--        같게 나오면 확정/예상 KPI가 잘못 혼합된 것 -> FAIL.


\echo '=== 5. v_formula_closeable ==='
SELECT
    formula_no,
    trade_done, delivery_done, cash_in_done, cash_out_done,
    invoice_done, logistics_done, can_close, is_closed
FROM v_formula_closeable
WHERE formula_id = '90040000-0000-0000-0003-000000000001';

-- 예상값: can_close = FALSE
-- (cash_in_done/cash_out_done은 TRUE이지만, trade_done/delivery_done/invoice_done/
--  logistics_done이 전부 FALSE이므로 can_close 전체는 FALSE)


\echo '=== 6. v_participant_confirmed_kpi ==='
SELECT
    company_name, role_group, sequence_order,
    total_buy_amount, total_sell_amount,
    confirmed_in, confirmed_out,
    scheduled_in, scheduled_out,
    receivable, payable, confirmed_net_profit
FROM v_participant_confirmed_kpi
WHERE formula_id = '90040000-0000-0000-0003-000000000001'
ORDER BY sequence_order;

-- 예상값:
--   US Supplier Inc : 전부 0 (schedule/record의 participant_id가 아님)
--   GioWorks Import : total_buy_amount=2,700,000, total_sell_amount=4,000,000,
--                     confirmed_in=4,000,000, confirmed_out=2,700,000,
--                     scheduled_in=4,000,000, scheduled_out=2,700,000,
--                     receivable=0, payable=0, confirmed_net_profit=1,300,000
--   Korea Buyer Co  : 전부 0


\echo '=== 7. Expected vs Actual 종합 비교 (PASS/FAIL 자동 판정) ==='
WITH expected(metric, expected_value) AS (
    VALUES
        ('confirmed_revenue',    4000000::numeric),
        ('confirmed_payment',    2700000::numeric),
        ('confirmed_net_profit', 1300000::numeric),
        ('expected_revenue',     4000000::numeric),
        ('expected_buy',         2700000::numeric),
        ('expected_cost',         200000::numeric),
        ('expected_share',        100000::numeric),
        ('expected_net_profit',  1000000::numeric),
        ('receivable',                 0::numeric),
        ('payable',                    0::numeric),
        ('receive_rate',          100.00::numeric),
        ('payment_rate',          100.00::numeric)
),
kpi AS (
    SELECT * FROM v_formula_confirmed_kpi
    WHERE formula_id = '90040000-0000-0000-0003-000000000001'
),
profit AS (
    SELECT * FROM v_formula_profit_engine
    WHERE formula_id = '90040000-0000-0000-0003-000000000001'
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
    SELECT 'expected_buy',                p.expected_buy             FROM profit p UNION ALL
    SELECT 'expected_cost',               p.expected_cost            FROM profit p UNION ALL
    SELECT 'expected_share',              p.expected_share           FROM profit p UNION ALL
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

-- 12개 행 전부 result='PASS'가 나와야 정상.


\echo '=== 8. 확정순이익 != 예상순이익 별도 단독 확인 (가장 중요한 회귀 방지 체크) ==='
SELECT
    confirmed_net_profit, expected_net_profit,
    CASE WHEN confirmed_net_profit != expected_net_profit THEN 'PASS' ELSE 'FAIL' END AS mix_check
FROM v_formula_profit_engine
WHERE formula_id = '90040000-0000-0000-0003-000000000001';

-- PASS여야 함. FAIL이면 확정/예상 KPI가 어딘가에서 혼합되었다는 뜻.


\echo '=== 9. can_close FALSE 단독 재확인 ==='
SELECT
    CASE WHEN can_close = FALSE THEN 'PASS' ELSE 'FAIL' END AS can_close_check
FROM v_formula_closeable
WHERE formula_id = '90040000-0000-0000-0003-000000000001';


\echo '=== 10. adjusted_exchange_rate가 계산에 영향을 주지 않았는지 확인 ==='
-- contract_exchange_rate(1350) 기준으로 계산했을 때만 2,700,000이 나온다.
-- 만약 adjusted_exchange_rate(1380)가 잘못 섞였다면 1,000*2.00*1380=2,760,000이 나와야 하므로
-- 아래 비교로 어느 환율이 실제 반영됐는지 역산 확인한다.
SELECT
    fp.total_buy_amount,
    fp.total_buy_amount / fp.quantity AS implied_unit_price_krw,
    f.contract_exchange_rate,
    f.adjusted_exchange_rate,
    CASE
        WHEN fp.total_buy_amount = 1000 * 2.00 * f.contract_exchange_rate THEN 'PASS (contract 기준 적용 확인)'
        WHEN fp.total_buy_amount = 1000 * 2.00 * f.adjusted_exchange_rate THEN 'FAIL (adjusted가 잘못 섞임)'
        ELSE 'FAIL (알 수 없는 값)'
    END AS exchange_rate_basis_check
FROM formula_participants fp
JOIN formulas f ON f.id = fp.formula_id
WHERE fp.formula_id = '90040000-0000-0000-0003-000000000001'
  AND fp.sequence_order = 2;  -- GioWorks Import
