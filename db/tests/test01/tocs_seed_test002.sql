-- =============================================================================
-- TOCS TEST-002 Seed Data — Payment Engine 예외 검증
-- =============================================================================
-- 거래 흐름: Supplier A → GioWorks → Buyer B
-- 품목: 재활용 원료 테스트-002, 수량 10,000 kg
-- 단가: Supplier A(매출500) / GioWorks(매입500,매출800) / Buyer B(매입800)
--
-- 검증 목적:
--   1. 분할입금 (3,000,000 + 2,000,000 + 1,500,000)
--   2. 부분출금 (5,000,000 예정 중 3,000,000만 완료)
--   3. 입금완료 취소 후 재입금 (3차 1,000,000 COMPLETED -> CANCELED, 4차 1,500,000 신규 입금)
--   4. is_canceled=TRUE 레코드의 KPI 제외
--
-- 전제: base schema + supplement + amount_verified fix + TEST-001 seed 적용 완료 상태
-- UUID는 TEST-001(1~9,a,b,c 계열)과 겹치지 않도록 d/e/f/0 계열 사용
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. companies
-- =============================================================================

INSERT INTO companies (id, company_name, business_reg_no, representative_name, main_phone, hq_address, is_active) VALUES
('dddddddd-dddd-dddd-dddd-dddddddddd01', 'Supplier A', '601-81-00006', '김서플라이', '02-6000-0006', '서울시 송파구 올림픽로 100', TRUE),
('dddddddd-dddd-dddd-dddd-dddddddddd02', 'GioWorks',   '701-81-00007', '김지오2',   '02-7000-0007', '서울시 강남구 역삼로 200', TRUE),
('dddddddd-dddd-dddd-dddd-dddddddddd03', 'Buyer B',    '801-81-00008', '이바이어',  '02-8000-0008', '서울시 마포구 양화로 300', TRUE);

-- =============================================================================
-- 2. items
-- =============================================================================

INSERT INTO items (id, item_code, item_name, default_unit, category, is_active) VALUES
('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee01', 'ITEM-RECY-002', '재활용 원료 테스트-002', 'kg', '재활용원료', TRUE);

-- =============================================================================
-- 3. formulas
-- 종결 조건과 무관하게 모두 미완료 상태로 시작 (can_close = FALSE 검증 목적)
-- =============================================================================

INSERT INTO formulas (
    id, trade_type, item_id, unit, quantity,
    base_currency,
    content, note,
    trade_status, delivery_status, cash_in_status, cash_out_status,
    invoice_status, logistics_status,
    is_closed, created_by
) VALUES (
    'ffffffff-ffff-ffff-ffff-ffffffffff01',
    'DOMESTIC',
    'eeeeeeee-eeee-eeee-eeee-eeeeeeeeee01',
    'kg',
    10000,
    'KRW',
    'TEST-002: Supplier A -> GioWorks -> Buyer B Payment Engine 예외 검증',
    '분할입금/부분출금/입금완료취소후재입금/is_canceled KPI제외 검증용 시나리오',
    'IN_PROGRESS',
    'IN_PROGRESS',
    'PARTIAL',   -- cash_in_status: 입금 진행중 (전액 미완료)
    'PARTIAL',   -- cash_out_status: 출금 진행중 (전액 미완료)
    'NOT_ISSUED',
    'DRAFT',
    FALSE,
    'system_seed'
);

-- =============================================================================
-- 4. formula_participants
-- =============================================================================

INSERT INTO formula_participants (
    id, formula_id, company_id, sequence_order,
    role_group, nature_group, payment_group,
    buy_unit_price, sell_unit_price, quantity,
    direct_cost_amount,
    is_start_point, is_end_point
) VALUES
-- 1. Supplier A (시작점, 매입가 0)
('00000000-0000-0000-0001-000000000001',
 'ffffffff-ffff-ffff-ffff-ffffffffff01',
 'dddddddd-dddd-dddd-dddd-dddddddddd01',
 1, 'SUPPLIER', 'MANUFACTURER', 'POST_SETTLEMENT',
 0, 500, 10000, 0, TRUE, FALSE),

-- 2. GioWorks (중간 트레이더)
('00000000-0000-0000-0001-000000000002',
 'ffffffff-ffff-ffff-ffff-ffffffffff01',
 'dddddddd-dddd-dddd-dddd-dddddddddd02',
 2, 'BUYER', 'DISTRIBUTOR', 'PARTIAL',
 500, 800, 10000, 0, FALSE, FALSE),

-- 3. Buyer B (종료점, 매출가 0)
('00000000-0000-0000-0001-000000000003',
 'ffffffff-ffff-ffff-ffff-ffffffffff01',
 'dddddddd-dddd-dddd-dddd-dddddddddd03',
 3, 'BUYER', 'DISTRIBUTOR', 'INSTALLMENT',
 800, 0, 10000, 0, FALSE, TRUE);

-- =============================================================================
-- 5. formula_payment_schedules
-- IN : Buyer B -> GioWorks  총 8,000,000 (분할입금 예정)
-- OUT: GioWorks -> Supplier A 총 5,000,000 (부분출금 예정)
-- =============================================================================

INSERT INTO formula_payment_schedules (
    id, formula_id, participant_id, direction, payment_type,
    counterparty_company_id, scheduled_amount, scheduled_date, status
) VALUES
-- IN schedule (GioWorks participant 기준, Buyer B로부터 받을 돈)
('00000000-0000-0000-0002-000000000001',
 'ffffffff-ffff-ffff-ffff-ffffffffff01',
 '00000000-0000-0000-0001-000000000002',
 'IN', 'INSTALLMENT',
 'dddddddd-dddd-dddd-dddd-dddddddddd03',
 8000000, '2026-07-01', 'PARTIAL'),

-- OUT schedule (GioWorks participant 기준, Supplier A에게 줄 돈)
('00000000-0000-0000-0002-000000000002',
 'ffffffff-ffff-ffff-ffff-ffffffffff01',
 '00000000-0000-0000-0001-000000000002',
 'OUT', 'POST_SETTLEMENT',
 'dddddddd-dddd-dddd-dddd-dddddddddd01',
 5000000, '2026-07-05', 'PARTIAL');

-- =============================================================================
-- 6. formula_payment_records
-- IN  1차: 3,000,000 COMPLETED
-- IN  2차: 2,000,000 COMPLETED
-- IN  3차: 1,000,000 COMPLETED -> 이후 UPDATE로 is_canceled=TRUE 처리
-- IN  4차: 1,500,000 COMPLETED (3차 취소 후 재입금)
-- OUT 1차: 2,000,000 COMPLETED
-- OUT 2차: 1,000,000 COMPLETED
--
-- direction은 트리거(trg_check_record_direction)에 의해 schedule.direction과
-- 반드시 일치해야 하므로 모두 동일 schedule_id를 참조하며 direction을 맞춤.
-- =============================================================================

-- IN 1차
INSERT INTO formula_payment_records (
    id, formula_id, payment_schedule_id, participant_id, direction,
    counterparty_company_id, actual_amount, actual_date,
    bank_name, account_name, account_no,
    confirmed_by, confirmed_at, status, is_canceled
) VALUES (
    '00000000-0000-0000-0003-000000000001',
    'ffffffff-ffff-ffff-ffff-ffffffffff01',
    '00000000-0000-0000-0002-000000000001',
    '00000000-0000-0000-0001-000000000002',
    'IN',
    'dddddddd-dddd-dddd-dddd-dddddddddd03',
    3000000, '2026-07-01',
    '국민은행', 'GioWorks', '111222-33-444555',
    '박실무', '2026-07-01 10:00:00+09', 'COMPLETED', FALSE
);

-- IN 2차
INSERT INTO formula_payment_records (
    id, formula_id, payment_schedule_id, participant_id, direction,
    counterparty_company_id, actual_amount, actual_date,
    bank_name, account_name, account_no,
    confirmed_by, confirmed_at, status, is_canceled
) VALUES (
    '00000000-0000-0000-0003-000000000002',
    'ffffffff-ffff-ffff-ffff-ffffffffff01',
    '00000000-0000-0000-0002-000000000001',
    '00000000-0000-0000-0001-000000000002',
    'IN',
    'dddddddd-dddd-dddd-dddd-dddddddddd03',
    2000000, '2026-07-03',
    '국민은행', 'GioWorks', '111222-33-444555',
    '박실무', '2026-07-03 10:00:00+09', 'COMPLETED', FALSE
);

-- IN 3차: 최초 입금 완료 (이후 즉시 취소 처리)
INSERT INTO formula_payment_records (
    id, formula_id, payment_schedule_id, participant_id, direction,
    counterparty_company_id, actual_amount, actual_date,
    bank_name, account_name, account_no,
    confirmed_by, confirmed_at, status, is_canceled
) VALUES (
    '00000000-0000-0000-0003-000000000003',
    'ffffffff-ffff-ffff-ffff-ffffffffff01',
    '00000000-0000-0000-0002-000000000001',
    '00000000-0000-0000-0001-000000000002',
    'IN',
    'dddddddd-dddd-dddd-dddd-dddddddddd03',
    1000000, '2026-07-05',
    '국민은행', 'GioWorks', '111222-33-444555',
    '박실무', '2026-07-05 10:00:00+09', 'COMPLETED', FALSE
);

-- [완료취소 처리] 3차 레코드를 COMPLETED 상태로 둔 채 is_canceled=TRUE, 취소 정보 기록
-- (TOCS 원칙: 삭제 금지, 취소 상태로 보존)
UPDATE formula_payment_records
SET is_canceled = TRUE,
    canceled_at = '2026-07-06 09:00:00+09',
    cancel_reason = '오입금 확인 - 실제 입금자 상이로 인한 취소',
    updated_at = NOW()
WHERE id = '00000000-0000-0000-0003-000000000003';

-- IN 4차: 3차 취소 후 재입금 (별도 신규 레코드)
INSERT INTO formula_payment_records (
    id, formula_id, payment_schedule_id, participant_id, direction,
    counterparty_company_id, actual_amount, actual_date,
    bank_name, account_name, account_no,
    confirmed_by, confirmed_at, status, is_canceled, memo
) VALUES (
    '00000000-0000-0000-0003-000000000004',
    'ffffffff-ffff-ffff-ffff-ffffffffff01',
    '00000000-0000-0000-0002-000000000001',
    '00000000-0000-0000-0001-000000000002',
    'IN',
    'dddddddd-dddd-dddd-dddd-dddddddddd03',
    1500000, '2026-07-07',
    '국민은행', 'GioWorks', '111222-33-444555',
    '박실무', '2026-07-07 10:00:00+09', 'COMPLETED', FALSE,
    '3차 취소(1,000,000) 후 정상 재입금'
);

-- OUT 1차: Supplier A에게 2,000,000 지급 완료
INSERT INTO formula_payment_records (
    id, formula_id, payment_schedule_id, participant_id, direction,
    counterparty_company_id, actual_amount, actual_date,
    bank_name, account_name, account_no,
    confirmed_by, confirmed_at, status, is_canceled
) VALUES (
    '00000000-0000-0000-0003-000000000005',
    'ffffffff-ffff-ffff-ffff-ffffffffff01',
    '00000000-0000-0000-0002-000000000002',
    '00000000-0000-0000-0001-000000000002',
    'OUT',
    'dddddddd-dddd-dddd-dddd-dddddddddd01',
    2000000, '2026-07-02',
    '신한은행', 'Supplier A', '222333-44-555666',
    '박실무', '2026-07-02 14:00:00+09', 'COMPLETED', FALSE
);

-- OUT 2차: Supplier A에게 1,000,000 지급 완료 (잔금 2,000,000은 미지급 상태로 남김)
INSERT INTO formula_payment_records (
    id, formula_id, payment_schedule_id, participant_id, direction,
    counterparty_company_id, actual_amount, actual_date,
    bank_name, account_name, account_no,
    confirmed_by, confirmed_at, status, is_canceled
) VALUES (
    '00000000-0000-0000-0003-000000000006',
    'ffffffff-ffff-ffff-ffff-ffffffffff01',
    '00000000-0000-0000-0002-000000000002',
    '00000000-0000-0000-0001-000000000002',
    'OUT',
    'dddddddd-dddd-dddd-dddd-dddddddddd01',
    1000000, '2026-07-04',
    '신한은행', 'Supplier A', '222333-44-555666',
    '박실무', '2026-07-04 14:00:00+09', 'COMPLETED', FALSE
);

-- =============================================================================
-- 7. formula_shares — GioWorks 마진의 셰어 배분 (예상비용/예상셰어 반영용)
-- =============================================================================

INSERT INTO formula_shares (
    id, formula_id, participant_id, target_company_id,
    share_basis, share_method, share_rate, share_amount, memo
) VALUES (
    '00000000-0000-0000-0004-000000000001',
    'ffffffff-ffff-ffff-ffff-ffffffffff01',
    '00000000-0000-0000-0001-000000000002',
    'dddddddd-dddd-dddd-dddd-dddddddddd03',
    'PROFIT', 'FIXED_AMOUNT', NULL, 200000,
    'GioWorks 마진 중 Buyer B 인센티브 고정 배분'
);

-- =============================================================================
-- 8. formula_versions + formula_calculation_snapshots
-- 예상순이익(GioWorks 관점) = 8,000,000 - 5,000,000 - 300,000 - 200,000 = 2,500,000
-- =============================================================================

INSERT INTO formula_versions (
    id, formula_id, version_no, changed_by, change_reason, snapshot
) VALUES (
    '00000000-0000-0000-0005-000000000001',
    'ffffffff-ffff-ffff-ffff-ffffffffff01',
    1, 'system_seed', 'TEST-002 초기 등록',
    '{"schema_version": "v1.6.1", "event": "initial_seed", "quantity": 10000}'::jsonb
);

INSERT INTO formula_calculation_snapshots (
    id, formula_id, formula_version_id,
    quantity, total_buy_amount, total_sell_amount,
    total_cost, total_share, net_profit, profit_rate,
    snapshot_data
) VALUES (
    '00000000-0000-0000-0006-000000000001',
    'ffffffff-ffff-ffff-ffff-ffffffffff01',
    '00000000-0000-0000-0005-000000000001',
    10000, 5000000, 8000000,
    300000, 200000, 2500000, 31.2500,
    '{"basis": "GioWorks 관점", "formula": "total_sell - total_buy - total_cost - total_share"}'::jsonb
);

COMMIT;
