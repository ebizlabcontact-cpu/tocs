-- =============================================================================
-- TOCS TEST-010 View 검증 SQL — Formula Cancel Flow 검증
-- =============================================================================
-- 전제: base + supplement + amount_verified fix + TEST-001~009 + TEST-010 seed
--       순서대로 적용 완료된 상태 (TEST-010 seed의 트랜잭션 2는 의도적으로
--       ROLLBACK되어 데이터가 남지 않음 - 아래 검증 11번에서 이를 직접 확인)
--
-- formula_id (메인, 취소됨) = '90100000-0000-0000-0003-000000000001'
-- formula_id (음성테스트, ROLLBACK됨) = '90100000-0000-0000-0013-000000000001'
-- =============================================================================

\echo '=== 1. 취소 대상 Formula 생성 + 6개 상태 전부 CANCELED 확인 ==='
SELECT
    formula_no,
    trade_status, delivery_status, cash_in_status, cash_out_status,
    invoice_status, logistics_status,
    is_closed, closed_at,
    CASE WHEN trade_status='CANCELED' AND delivery_status='CANCELED'
          AND cash_in_status='CANCELED' AND cash_out_status='CANCELED'
          AND invoice_status='CANCELED' AND logistics_status='CANCELED'
         THEN 'PASS' ELSE 'FAIL' END AS all_six_canceled_check
FROM formulas
WHERE id = '90100000-0000-0000-0003-000000000001';

-- 예상값: 6개 상태 전부 'CANCELED', all_six_canceled_check='PASS'


\echo '=== 2. is_closed = FALSE 유지 확인 (정책: 취소는 종결이 아니다) ==='
SELECT
    is_closed, closed_at,
    CASE WHEN is_closed = FALSE AND closed_at IS NULL THEN 'PASS' ELSE 'FAIL' END AS is_closed_false_check
FROM formulas
WHERE id = '90100000-0000-0000-0003-000000000001';

-- 예상값: is_closed=FALSE, closed_at=NULL, PASS


\echo '=== 3. 입금 record 1건 존재 + is_canceled=FALSE 확인 ==='
SELECT
    direction, actual_amount, status, is_canceled,
    CASE WHEN actual_amount=1500000 AND status='COMPLETED' AND is_canceled=FALSE
         THEN 'PASS' ELSE 'FAIL' END AS record_check
FROM formula_payment_records
WHERE formula_id = '90100000-0000-0000-0003-000000000001';

-- 예상값: 1건. actual_amount=1,500,000, status=COMPLETED, is_canceled=FALSE, PASS


\echo '=== 4. formula_status_logs 6건 기록 확인 ==='
SELECT
    status_target, prev_status, new_status,
    COUNT(*) OVER () AS total_count
FROM formula_status_logs
WHERE formula_id = '90100000-0000-0000-0003-000000000001'
ORDER BY status_target;

-- 예상값: 6행, total_count=6, 각 행의 new_status='CANCELED'


\echo '=== 4-1. formula_status_logs 6건 카운트 PASS/FAIL ==='
SELECT
    COUNT(*) AS log_count,
    CASE WHEN COUNT(*) = 6 THEN 'PASS' ELSE 'FAIL' END AS log_count_check
FROM formula_status_logs
WHERE formula_id = '90100000-0000-0000-0003-000000000001';


\echo '=== 5. audit_logs 1건 기록 확인 ==='
SELECT
    table_name, record_id, action, changed_by,
    CASE WHEN action = 'CANCEL' THEN 'PASS' ELSE 'FAIL' END AS audit_check
FROM audit_logs
WHERE record_id = '90100000-0000-0000-0003-000000000001'
  AND table_name = 'formulas';

-- 예상값: 1건, action='CANCEL', PASS


\echo '=== 6. v_formula_closeable.can_close = FALSE 확인 ==='
SELECT
    trade_done, delivery_done, cash_in_done, cash_out_done,
    invoice_done, logistics_done, can_close,
    CASE WHEN can_close = FALSE THEN 'PASS' ELSE 'FAIL' END AS can_close_check
FROM v_formula_closeable
WHERE formula_id = '90100000-0000-0000-0003-000000000001';

-- 예상값: 6개 _done 컬럼 전부 FALSE (CANCELED != COMPLETED/AMOUNT_MATCHED 단순 비교 결과),
--        can_close=FALSE, PASS


\echo '=== 7. v_formula_confirmed_kpi가 기존 입금 record를 그대로 반영하는지 확인 ==='
SELECT
    confirmed_revenue, confirmed_payment, scheduled_revenue,
    CASE WHEN confirmed_revenue = 1500000 THEN 'PASS' ELSE 'FAIL' END AS kpi_reflects_record_check
FROM v_formula_confirmed_kpi
WHERE formula_id = '90100000-0000-0000-0003-000000000001';

-- 예상값: confirmed_revenue=1,500,000 (CANCELED 전환과 무관하게 실제 입금액 그대로 반영).
-- [정책 확인] 이 View는 formulas의 상태 컬럼을 필터 조건으로 사용하지 않으므로
-- 취소 여부와 무관하게 실제 돈 흐름을 그대로 보여준다. 이것이 PASS인 이유는
-- "취소 거래 제외는 API/UI 책임"이라는 확정 정책과 일치하기 때문이다.


\echo '=== 8. v_formula_profit_engine이 기존 snapshot을 그대로 반영하는지 확인 ==='
SELECT
    confirmed_net_profit, expected_net_profit,
    CASE WHEN confirmed_net_profit = 1500000 AND expected_net_profit = 500000
         THEN 'PASS' ELSE 'FAIL' END AS profit_engine_check
FROM v_formula_profit_engine
WHERE formula_id = '90100000-0000-0000-0003-000000000001';

-- 예상값: confirmed_net_profit=1,500,000(실입금 그대로), expected_net_profit=500,000
--        (취소 전 저장된 snapshot 값 그대로). 둘 다 CANCELED 전환의 영향을 받지 않음.


\echo '=== 9. v_participant_confirmed_kpi가 기존 입금 record를 그대로 반영하는지 확인 ==='
SELECT
    company_name, role_group, sequence_order,
    confirmed_in, confirmed_out,
    CASE WHEN confirmed_in = 1500000 THEN 'PASS' ELSE 'FAIL' END AS participant_kpi_check
FROM v_participant_confirmed_kpi
WHERE formula_id = '90100000-0000-0000-0003-000000000001'
  AND sequence_order = 2;

-- 예상값: GioWorks Cancel 행에서 confirmed_in=1,500,000, PASS


\echo '=== 10. 종결 Formula 취소 시도 음성 테스트 결과 확인 (트랜잭션 2가 ROLLBACK 되었는지) ==='
-- 음성 테스트용 Formula(closed_at 부여 후 trade_status=CANCELED 시도)가
-- DB에 전혀 존재하지 않아야 한다(트랜잭션 2가 ROLLBACK으로 전부 폐기됨).
-- *** 이 쿼리에서 0 rows가 나오는 것이 정상(PASS)이다. ***
SELECT
    COUNT(*) AS negative_test_formula_count,
    CASE WHEN COUNT(*) = 0 THEN 'PASS (ROLLBACK 정상 적용됨)' ELSE 'FAIL (데이터가 남아있음)' END AS rollback_check
FROM formulas
WHERE id = '90100000-0000-0000-0013-000000000001';

-- 예상값: negative_test_formula_count=0, PASS
-- [실행자 참고] Seed SQL 실행 시 화면에 다음 ERROR가 출력된 것을 직접
-- 확인했어야 한다. 이 ERROR가 곧 음성 테스트의 핵심 증거다.
--   ERROR: new row for relation "formulas" violates check constraint
--          "chk_closed_requires_all_completed"
-- 이 ERROR 없이 위 쿼리가 0을 반환했다면(예: 트랜잭션 2 자체가 실행되지
-- 않은 경우), 그것은 음성 테스트가 "수행되지 않은 것"이며 "통과한 것"이
-- 아니다. ERROR 출력 여부를 Seed 실행 로그에서 반드시 별도로 확인할 것.


\echo '=== 11. formula_payment_records.is_canceled와 formulas.*_status=CANCELED 독립성 확인 ==='
-- 입금 record의 is_canceled는 FALSE로 유지되어야 한다(돈은 실제로 들어왔으므로).
-- formulas 상태가 CANCELED로 바뀌었다고 해서 record.is_canceled가 자동으로
-- TRUE로 바뀌는 트리거나 로직은 존재하지 않는다 - 두 메커니즘은 완전히 독립.
SELECT
    fpr.is_canceled AS record_is_canceled,
    f.trade_status AS formula_trade_status,
    CASE WHEN fpr.is_canceled = FALSE AND f.trade_status = 'CANCELED'
         THEN 'PASS (두 메커니즘 독립 확인)' ELSE 'FAIL' END AS independence_check
FROM formula_payment_records fpr
JOIN formulas f ON f.id = fpr.formula_id
WHERE fpr.formula_id = '90100000-0000-0000-0003-000000000001';

-- 예상값: record_is_canceled=FALSE, formula_trade_status=CANCELED, PASS
-- (record는 취소되지 않았는데 formula는 취소된 상태 - 두 값이 서로 다른 것이
--  바로 "독립적인 메커니즘"이라는 증거다)


\echo '=== 12. Expected vs Actual 종합 비교 (PASS/FAIL 자동 판정) ==='
WITH expected(metric, expected_value) AS (
    VALUES
        ('confirmed_revenue',     1500000::numeric),
        ('confirmed_net_profit',  1500000::numeric),
        ('expected_net_profit',    500000::numeric),
        ('status_log_count',            6::numeric),
        ('audit_log_count',             1::numeric),
        ('negative_test_residual_count', 0::numeric)
),
kpi AS (SELECT * FROM v_formula_confirmed_kpi WHERE formula_id = '90100000-0000-0000-0003-000000000001'),
profit AS (SELECT * FROM v_formula_profit_engine WHERE formula_id = '90100000-0000-0000-0003-000000000001'),
counts AS (
    SELECT
        (SELECT COUNT(*) FROM formula_status_logs WHERE formula_id = '90100000-0000-0000-0003-000000000001') AS status_log_count,
        (SELECT COUNT(*) FROM audit_logs WHERE record_id = '90100000-0000-0000-0003-000000000001' AND action='CANCEL') AS audit_log_count,
        (SELECT COUNT(*) FROM formulas WHERE id = '90100000-0000-0000-0013-000000000001') AS negative_test_residual_count
),
actual AS (
    SELECT 'confirmed_revenue'    AS metric, kpi.confirmed_revenue        AS actual_value FROM kpi UNION ALL
    SELECT 'confirmed_net_profit',          profit.confirmed_net_profit  FROM profit UNION ALL
    SELECT 'expected_net_profit',           profit.expected_net_profit   FROM profit UNION ALL
    SELECT 'status_log_count',              counts.status_log_count::numeric FROM counts UNION ALL
    SELECT 'audit_log_count',               counts.audit_log_count::numeric FROM counts UNION ALL
    SELECT 'negative_test_residual_count',  counts.negative_test_residual_count::numeric FROM counts
)
SELECT
    e.metric, e.expected_value, a.actual_value,
    CASE WHEN e.expected_value = a.actual_value THEN 'PASS' ELSE 'FAIL' END AS result
FROM expected e
JOIN actual a ON a.metric = e.metric
ORDER BY e.metric;

-- 6개 행 전부 result='PASS'가 나와야 정상.
