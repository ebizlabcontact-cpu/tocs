-- =============================================================================
-- TOCS TEST-001 View 검증 SQL
-- =============================================================================
-- 전제: tocs_base_schema.sql + tocs_supplement.sql + tocs_seed_test001.sql
--       순서대로 실행 완료된 상태
--
-- formula_id = '33333333-3333-3333-3333-333333333301' (TEST-001)
-- participant_id(지오웍스) = '44444444-4444-4444-4444-444444444402'
--
-- 각 쿼리 위에 "사전 계산된 예상값"을 주석으로 명시.
-- 실제 실행 결과와 이 예상값이 다르면 스키마 또는 시드 데이터에 문제가 있는 것.
-- =============================================================================

-- =============================================================================
-- 1. v_formula_profit_engine
-- =============================================================================
-- 예상값:
--   confirmed_revenue      = 6,123,630 + 14,288,470 = 20,412,100   (IN 완료분 전체)
--   confirmed_cost_total   = 10,044,370 + 500,000    = 10,544,370  (OUT 완료분: CJ선지급+운송비. CJ잔금 PENDING은 제외)
--   confirmed_net_profit   = 20,412,100 - 10,544,370 = 9,867,730
--   expected_revenue       = 20,412,100
--   expected_buy           = 14,349,100
--   expected_cost          = 500,000
--   expected_share         = 606,300
--   expected_net_profit    = 4,956,700
--   expected_profit_rate   = 24.2831

SELECT
    formula_no,
    confirmed_revenue, confirmed_cost_total, confirmed_net_profit,
    expected_revenue, expected_buy, expected_cost, expected_share,
    expected_net_profit, expected_profit_rate
FROM v_formula_profit_engine
WHERE formula_id = '33333333-3333-3333-3333-333333333301';

-- =============================================================================
-- 2. v_formula_confirmed_kpi
-- =============================================================================
-- 예상값:
--   cash_in_status   = 'PARTIAL'   (시드에서 formulas.cash_in_status로 지정한 값. KPI 수치와는 별개로 수동관리 필드)
--   cash_out_status  = 'PARTIAL'
--   confirmed_revenue = 20,412,100
--   confirmed_payment = 10,544,370
--   scheduled_revenue = 6,123,630 + 14,288,470 = 20,412,100
--   scheduled_payment = 10,044,370 + 4,304,730 + 500,000 = 14,849,100
--   receivable (미수금) = 20,412,100 - 20,412,100 = 0          (전액 입금 완료)
--   payable    (미지급금) = 14,849,100 - 10,544,370 = 4,304,730  (CJ 잔금 미지급분과 정확히 일치해야 함)
--   receive_rate = 100.00
--   payment_rate = ROUND(10,544,370 / 14,849,100 * 100, 2) = 71.01

SELECT
    formula_no,
    cash_in_status, cash_out_status,
    confirmed_revenue, confirmed_payment,
    scheduled_revenue, scheduled_payment,
    receivable, payable,
    receive_rate, payment_rate
FROM v_formula_confirmed_kpi
WHERE formula_id = '33333333-3333-3333-3333-333333333301';

-- =============================================================================
-- 3. v_formula_closeable
-- =============================================================================
-- 예상값: 시드에서 다음과 같이 의도적으로 설정했으므로 can_close = FALSE 여야 함
--   trade_done     = FALSE (trade_status = IN_PROGRESS)
--   delivery_done  = FALSE (delivery_status = IN_PROGRESS)
--   cash_in_done   = FALSE (cash_in_status = PARTIAL, COMPLETED 아님)
--   cash_out_done  = FALSE (cash_out_status = PARTIAL)
--   invoice_done   = FALSE (invoice_status = ISSUED, AMOUNT_MATCHED 아님)
--   logistics_done = FALSE (logistics_status = IN_PROGRESS)
--   can_close      = FALSE (위 6개 중 전부 FALSE이므로 당연히 FALSE)
--   is_closed      = FALSE

SELECT
    formula_no,
    trade_done, delivery_done, cash_in_done, cash_out_done,
    invoice_done, logistics_done, can_close, is_closed
FROM v_formula_closeable
WHERE formula_id = '33333333-3333-3333-3333-333333333301';

-- =============================================================================
-- 4. v_participant_confirmed_kpi
-- =============================================================================
-- 예상값 (4개 participant 행이 나와야 함):
--
-- CJ제일제당 (seq=1, role=SUPPLIER):
--   total_buy_amount=0, total_sell_amount=14,349,100
--   confirmed_in=0, confirmed_out=0  (CJ는 schedule/record의 participant_id가 아니라 counterparty이므로
--                                     이 View의 participant_id 기준 집계에는 0으로 나옴 - 의도된 정책)
--   scheduled_in=0, scheduled_out=0
--   receivable=0, payable=0, confirmed_net_profit=0
--
-- 지오웍스 (seq=2, role=BUYER):
--   total_buy_amount=14,349,100, total_sell_amount=20,412,100
--   confirmed_in=20,412,100, confirmed_out=10,544,370
--   scheduled_in=20,412,100, scheduled_out=14,849,100
--   receivable=0, payable=4,304,730
--   confirmed_net_profit=20,412,100-10,544,370=9,867,730
--   (지오웍스만 모든 schedule/record의 participant_id로 지정했으므로 실질 KPI가 전부 여기 집계됨)
--
-- 네이처인사이트 (seq=3): 전부 0 (schedule/record participant_id로 지정 안 됨)
-- 에코앤리사이클 (seq=4): 전부 0

SELECT
    company_name, role_group, sequence_order,
    total_buy_amount, total_sell_amount,
    confirmed_in, confirmed_out,
    scheduled_in, scheduled_out,
    receivable, payable, confirmed_net_profit
FROM v_participant_confirmed_kpi
WHERE formula_id = '33333333-3333-3333-3333-333333333301'
ORDER BY sequence_order;

-- =============================================================================
-- 보너스: invoice amount_verified 트리거 동작 확인
-- =============================================================================
-- 예상값:
--   INV-1 (CJ->지오웍스):     amount_verified = TRUE  (external=total_amount=15,784,010)
--   INV-2 (지오웍스->네이처): amount_verified = FALSE (external=22,000,000 != total=22,453,310)
--   INV-3 (네이처->에코):     amount_verified = FALSE (external NULL)

SELECT
    invoice_no, sequence_order,
    external_invoice_amount, supply_amount, tax_amount, total_amount,
    amount_verified, status
FROM formula_invoices
WHERE formula_id = '33333333-3333-3333-3333-333333333301'
ORDER BY sequence_order;

-- =============================================================================
-- 보너스: v_formula_invoice_status 동작 확인
-- =============================================================================
-- 예상값: AMOUNT_MISMATCHED 1건 존재 -> derived_invoice_status = 'AMOUNT_MISMATCHED'
--        (우선순위 규칙상 MISMATCHED가 ISSUED보다 위에 있음)

SELECT formula_no, active_count, mismatched_count, in_progress_count,
       matched_count, derived_invoice_status
FROM v_formula_invoice_status
WHERE formula_id = '33333333-3333-3333-3333-333333333301';
