-- =============================================================================
-- TOCS TEST-008 View 검증 SQL — 부분 계산서/부분 입금/부분 출금 검증
-- =============================================================================
-- 전제: base + supplement + amount_verified fix + TEST-001~007 + TEST-008 seed
--       순서대로 적용 완료된 상태
--
-- formula_id (TEST-008) = '90080000-0000-0000-0003-000000000001'
-- =============================================================================

\echo '=== 1. formulas 직접 확인 (formula_no는 자동 채번 — prefix 형식 + UNIQUE 저장만 검증) ==='
SELECT
    formula_no,
    trade_type,
    trade_status, delivery_status, cash_in_status, cash_out_status,
    invoice_status, logistics_status,
    is_closed,
    CASE WHEN formula_no LIKE 'FM-2606-%' THEN 'PASS' ELSE 'FAIL' END AS formula_no_prefix_check
FROM formulas
WHERE id = '90080000-0000-0000-0003-000000000001';

-- 예상값: formula_no는 'FM-2606-' prefix를 가진 자동 채번값 (예: FM-2606-00011일 수도,
--        다른 번호일 수도 있음 - TEST-001~007의 자동채번 누적 횟수에 따라 달라짐).
--        이 번호 자체는 테스트 통과 조건이 아니며, prefix 형식만 검증한다.
--        cash_in_status=PARTIAL, cash_out_status=PARTIAL, invoice_status=ISSUED,
--        trade/delivery/logistics_status=IN_PROGRESS, is_closed=FALSE


\echo '=== 1-1. formula_no UNIQUE 정상 저장 여부 별도 확인 ==='
-- 자동채번이 기존 TEST-001~007의 formula_no와 중복되지 않았는지 직접 확인.
SELECT
    f.formula_no,
    COUNT(*) AS duplicate_count,
    CASE WHEN COUNT(*) = 1 THEN 'PASS' ELSE 'FAIL' END AS unique_check
FROM formulas f
WHERE f.formula_no = (
    SELECT formula_no FROM formulas WHERE id = '90080000-0000-0000-0003-000000000001'
)
GROUP BY f.formula_no;

-- 예상값: duplicate_count=1, unique_check='PASS'
-- (UNIQUE 제약이 DB 레벨에서 이미 보장하지만, 실제 저장 결과로도 재확인)


\echo '=== 2. v_formula_confirmed_kpi ==='
SELECT
    formula_no,
    cash_in_status, cash_out_status,
    confirmed_revenue, confirmed_payment,
    scheduled_revenue, scheduled_payment,
    receivable, payable,
    receive_rate, payment_rate
FROM v_formula_confirmed_kpi
WHERE formula_id = '90080000-0000-0000-0003-000000000001';

-- 예상값:
--   confirmed_revenue=1,000,000  confirmed_payment=500,000
--   scheduled_revenue=2,000,000  scheduled_payment=1,000,000
--   receivable=1,000,000         payable=500,000
--   receive_rate=50.00            payment_rate=50.00


\echo '=== 3. v_formula_profit_engine (확정 vs 예상 분리 검증) ==='
SELECT
    formula_no,
    confirmed_revenue, confirmed_cost_total, confirmed_net_profit,
    expected_revenue, expected_buy, expected_cost, expected_share, expected_net_profit
FROM v_formula_profit_engine
WHERE formula_id = '90080000-0000-0000-0003-000000000001';

-- 예상값:
--   confirmed_net_profit=500,000  (실입금1,000,000 - 실출금500,000)
--   expected_net_profit=1,000,000 (2,000,000-1,000,000-0-0)
--   주의: 두 값은 반드시 달라야 정상 (500,000 != 1,000,000).


\echo '=== 4. v_formula_invoice_status ==='
SELECT
    formula_no, active_count, matched_count, mismatched_count,
    in_progress_count, derived_invoice_status
FROM v_formula_invoice_status
WHERE formula_id = '90080000-0000-0000-0003-000000000001';

-- 예상값: active_count=2, matched_count=1, in_progress_count=1(ISSUED 1건),
--        derived_invoice_status='ISSUED'
-- (우선순위 규칙: MISMATCHED/REVISION_REQUIRED가 없고 in_progress_count>0이므로 ISSUED)


\echo '=== 5. formulas.invoice_status와 derived_invoice_status 일치 확인 ==='
SELECT
    f.invoice_status AS formulas_column_value,
    v.derived_invoice_status AS view_derived_value,
    CASE WHEN f.invoice_status = v.derived_invoice_status THEN 'PASS' ELSE 'FAIL' END AS match_check
FROM formulas f
JOIN v_formula_invoice_status v ON v.formula_id = f.id
WHERE f.id = '90080000-0000-0000-0003-000000000001';

-- PASS여야 함. 단, 이 일치는 DB가 자동 보장하는 게 아니라 이 Seed가 두 값을
-- 의도적으로 같게 설계했기 때문이다 (구조적 사실: 자동 동기화 트리거 없음).


\echo '=== 6. formula_invoices amount_verified 확인 ==='
SELECT
    invoice_no, sequence_order,
    external_invoice_amount, supply_amount, tax_amount, total_amount,
    amount_verified, status
FROM formula_invoices
WHERE formula_id = '90080000-0000-0000-0003-000000000001'
ORDER BY sequence_order;

-- 예상값:
--   Invoice#1: external=1,000,000, total=1,000,000, amount_verified=TRUE,  status=AMOUNT_MATCHED
--   Invoice#2: external=NULL,                        amount_verified=FALSE, status=ISSUED


\echo '=== 7. PARTIAL이 Schedule 기준이 아니라 Payment Record 기준인지 직접 증명 (핵심 검증) ==='
-- Schedule 자체의 status 컬럼(COMPLETED/PENDING)이 아니라
-- 실제 formula_payment_records 존재 여부로 cash_in/cash_out 합계가 갈리는지 확인.
WITH schedule_view AS (
    -- "스케줄 기준"으로 계산했다면 어떤 값이 나올지 (잘못된 가정의 시뮬레이션)
    SELECT
        SUM(scheduled_amount) FILTER (WHERE direction='IN' AND status='COMPLETED')  AS wrong_in_if_schedule_based,
        SUM(scheduled_amount) FILTER (WHERE direction='OUT' AND status='COMPLETED') AS wrong_out_if_schedule_based
    FROM formula_payment_schedules
    WHERE formula_id = '90080000-0000-0000-0003-000000000001'
),
record_view AS (
    -- "레코드 기준"(실제 View 로직)으로 계산한 값
    SELECT confirmed_revenue, confirmed_payment
    FROM v_formula_confirmed_kpi
    WHERE formula_id = '90080000-0000-0000-0003-000000000001'
)
SELECT
    sv.wrong_in_if_schedule_based, sv.wrong_out_if_schedule_based,
    rv.confirmed_revenue, rv.confirmed_payment,
    CASE WHEN sv.wrong_in_if_schedule_based = rv.confirmed_revenue
              AND sv.wrong_out_if_schedule_based = rv.confirmed_payment
         THEN 'IDENTICAL (이 케이스에서는 schedule.status=COMPLETED인 것과 record 존재가 우연히 1:1 대응)'
         ELSE 'DIFFERENT (record 기준이 schedule.status 기준과 다름을 증명)'
    END AS basis_note
FROM schedule_view sv, record_view rv;

-- [중요] 이번 시나리오는 schedule#1,#3이 status='COMPLETED'이면서 동시에 record도
-- 존재하므로, "schedule.status 기준 합산"과 "record 존재 기준 합산(View 실제 로직)"이
-- 우연히 같은 결과를 낸다. 이것만으로는 "record 기준으로 계산된다"는 증거가 안 되므로
-- 8번 쿼리로 더 엄격하게 증명한다.


\echo '=== 8. PARTIAL 계산 기준 엄격 증명 — schedule.status를 의도적으로 무시했을 때도 record 합계가 그대로인지 ==='
-- v_formula_confirmed_kpi의 confirmed 계열은 WHERE status='COMPLETED' AND NOT is_canceled
-- 라는 formula_payment_records 자체의 컬럼만 사용하며 formula_payment_schedules.status는
-- 전혀 참조하지 않는다. 이를 View 정의 자체에서 직접 확인한다.
SELECT
    pg_get_viewdef('v_formula_confirmed_kpi'::regclass, true) AS view_definition;

-- 위 view_definition 텍스트 안에서 "confirmed" CTE가 FROM formula_payment_records만 사용하고
-- formula_payment_schedules.status를 어디서도 참조하지 않는지 직접 눈으로 확인할 것.
-- (scheduled CTE는 scheduled_amount 집계용으로 schedule을 보지만, confirmed CTE는 보지 않음)


\echo '=== 9. v_participant_confirmed_kpi ==='
SELECT
    company_name, role_group, sequence_order,
    total_buy_amount, total_sell_amount,
    confirmed_in, confirmed_out,
    scheduled_in, scheduled_out,
    receivable, payable, confirmed_net_profit
FROM v_participant_confirmed_kpi
WHERE formula_id = '90080000-0000-0000-0003-000000000001'
ORDER BY sequence_order;

-- 예상값: GioWorks Partial 행만 0이 아님.
--   confirmed_in=1,000,000, confirmed_out=500,000,
--   scheduled_in=2,000,000, scheduled_out=1,000,000,
--   receivable=1,000,000, payable=500,000, confirmed_net_profit=500,000


\echo '=== 10. v_formula_closeable ==='
SELECT
    trade_done, delivery_done, cash_in_done, cash_out_done,
    invoice_done, logistics_done, can_close, is_closed
FROM v_formula_closeable
WHERE formula_id = '90080000-0000-0000-0003-000000000001';

-- 예상값: cash_in_done=FALSE(PARTIAL이므로), cash_out_done=FALSE, invoice_done=FALSE,
--        can_close=FALSE


\echo '=== 11. Expected vs Actual 종합 비교 (PASS/FAIL 자동 판정) ==='
WITH expected(metric, expected_value) AS (
    VALUES
        ('confirmed_revenue',     1000000::numeric),
        ('confirmed_payment',      500000::numeric),
        ('confirmed_net_profit',   500000::numeric),
        ('expected_revenue',     2000000::numeric),
        ('expected_buy',         1000000::numeric),
        ('expected_cost',               0::numeric),
        ('expected_share',              0::numeric),
        ('expected_net_profit',  1000000::numeric),
        ('receivable',           1000000::numeric),
        ('payable',                500000::numeric),
        ('receive_rate',           50.00::numeric),
        ('payment_rate',           50.00::numeric)
),
kpi AS (
    SELECT * FROM v_formula_confirmed_kpi
    WHERE formula_id = '90080000-0000-0000-0003-000000000001'
),
profit AS (
    SELECT * FROM v_formula_profit_engine
    WHERE formula_id = '90080000-0000-0000-0003-000000000001'
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


\echo '=== 12. 확정 != 예상 회귀 방지 체크 + can_close FALSE 단독 확인 ==='
SELECT
    confirmed_net_profit, expected_net_profit,
    CASE WHEN confirmed_net_profit != expected_net_profit THEN 'PASS' ELSE 'FAIL' END AS mix_check
FROM v_formula_profit_engine
WHERE formula_id = '90080000-0000-0000-0003-000000000001';

SELECT
    CASE WHEN can_close = FALSE THEN 'PASS' ELSE 'FAIL' END AS can_close_check
FROM v_formula_closeable
WHERE formula_id = '90080000-0000-0000-0003-000000000001';
