-- =============================================================================
-- TOCS TEST-004 Seed Data — 수입/환율 거래(IMPORT) 검증
-- =============================================================================
-- 거래 흐름: US Supplier Inc → GioWorks Import → Korea Buyer Co
-- 품목: Imported Raw Material, 수량 1,000 kg
-- 환율: contract_exchange_rate = 1,350 KRW/USD (계산 기준)
--       adjusted_exchange_rate = 1,380 KRW/USD (참고값으로만 저장)
--
-- [중요 설계 노트 - 통화 환산 처리]
-- formula_participants.buy_unit_price / sell_unit_price 컬럼은 통화 단위를
-- 구분하지 않고 quantity와 단순 곱셈(GENERATED)하여 total_buy/sell_amount를 만든다.
-- 따라서 원본 USD 단가(2.00)를 그대로 저장하면 GENERATED 컬럼이 KRW 기준
-- 예상매입(2,700,000)을 만들지 못한다.
-- => GioWorks/US Supplier 구간의 단가는 contract_exchange_rate(1,350)를 미리 곱한
--    "KRW 환산 단가"로 저장한다. 원본 USD 단가는 memo에 보존한다.
--    US Supplier sell_unit_price = 2.00 USD * 1,350 = 2,700 KRW
--    GioWorks    buy_unit_price  = 2.00 USD * 1,350 = 2,700 KRW (US Supplier와 동일 구간)
--    GioWorks    sell_unit_price = 4,000 KRW (이미 KRW 단가, 환산 불필요)
--    Korea Buyer buy_unit_price  = 4,000 KRW
--
-- [payment_type 보정]
-- 요청서의 payment_type='PREPAID'는 실제 payment_group ENUM에 존재하지 않는 값이다.
-- ENUM 정의: PREPAYMENT, CREDIT, POST_SETTLEMENT, INSTALLMENT, PARTIAL, OTHER
-- 의미상 가장 가까운 'PREPAYMENT'로 대체했다. (사전 지급이라는 의미는 동일하게 보존)
--
-- 전제: base + supplement + amount_verified fix + TEST-001~003 적용 완료 상태.
-- UUID는 '90040000-...' 패턴으로 기존 60개 UUID와 충돌 없음.
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. companies
-- =============================================================================

INSERT INTO companies (id, company_name, business_reg_no, representative_name, main_phone, hq_address, is_active) VALUES
('90040000-0000-0000-0001-000000000001', 'US Supplier Inc',  '904-81-00012', 'John Smith', '+1-555-0012', '123 Main St, Los Angeles, CA, USA', TRUE),
('90040000-0000-0000-0001-000000000002', 'GioWorks Import',  '905-81-00013', '김지오4',    '02-9300-0013', '서울시 강남구 테헤란로 456', TRUE),
('90040000-0000-0000-0001-000000000003', 'Korea Buyer Co',   '906-81-00014', '한바이어',   '02-9400-0014', '인천시 연수구 송도로 12', TRUE);

-- =============================================================================
-- 2. items
-- =============================================================================

INSERT INTO items (id, item_code, item_name, default_unit, category, is_active) VALUES
('90040000-0000-0000-0002-000000000001', 'ITEM-IMPORT-004', 'Imported Raw Material', 'kg', '수입원료', TRUE);

-- =============================================================================
-- 3. formulas
-- trade_type=IMPORT, foreign_currency=USD, contract/adjusted exchange rate 모두 저장.
-- chk_domestic_no_exchange CHECK는 trade_type != 'DOMESTIC'이면 무조건 통과하므로
-- IMPORT + 환율 입력은 제약 위반 없음.
-- =============================================================================

INSERT INTO formulas (
    id, trade_type, item_id, unit, quantity,
    base_currency, foreign_currency,
    departure_country, arrival_country,
    contract_exchange_rate, adjusted_exchange_rate,
    content, note,
    trade_status, delivery_status, cash_in_status, cash_out_status,
    invoice_status, logistics_status,
    is_closed, created_by
) VALUES (
    '90040000-0000-0000-0003-000000000001',
    'IMPORT',
    '90040000-0000-0000-0002-000000000001',
    'kg',
    1000,
    'KRW', 'USD',
    'USA', 'KOR',
    1350, 1380,
    'TEST-004: US Supplier Inc -> GioWorks Import -> Korea Buyer Co 수입/환율 거래 검증',
    '기준 계산은 contract_exchange_rate(1,350) 기준. adjusted_exchange_rate(1,380)는 참고값으로만 저장.
원본 USD 단가: US Supplier sell=2.00 USD/kg, GioWorks buy=2.00 USD/kg (KRW 환산값은 participants에 저장).',
    'IN_PROGRESS',
    'IN_PROGRESS',
    'COMPLETED',  -- cash_in_status: 입금 1건 전액 완료
    'COMPLETED',  -- cash_out_status: 출금 1건 전액 완료
    'NOT_ISSUED',
    'DRAFT',
    FALSE,
    'system_seed'
);

-- =============================================================================
-- 4. formula_participants
-- buy/sell_unit_price는 모두 KRW 환산 기준 (위 설계 노트 참조)
-- =============================================================================

INSERT INTO formula_participants (
    id, formula_id, company_id, sequence_order,
    role_group, nature_group, payment_group,
    buy_unit_price, sell_unit_price, quantity,
    direct_cost_amount,
    is_start_point, is_end_point, memo
) VALUES
-- 1. US Supplier Inc (시작점, 매입가 0)
-- sell_unit_price = 2.00 USD * 1,350 = 2,700 KRW (KRW 환산)
('90040000-0000-0000-0004-000000000001',
 '90040000-0000-0000-0003-000000000001',
 '90040000-0000-0000-0001-000000000001',
 1, 'SUPPLIER', 'MANUFACTURER', 'PREPAYMENT',
 0, 2700, 1000, 0, TRUE, FALSE,
 '원본 매출단가: 2.00 USD/kg (contract_exchange_rate 1,350 적용 환산값)'),

-- 2. GioWorks Import (중간 트레이더)
-- buy_unit_price = 2.00 USD * 1,350 = 2,700 KRW (KRW 환산), sell_unit_price = 4,000 KRW (원화 그대로)
('90040000-0000-0000-0004-000000000002',
 '90040000-0000-0000-0003-000000000001',
 '90040000-0000-0000-0001-000000000002',
 2, 'BUYER', 'DISTRIBUTOR', 'CREDIT',
 2700, 4000, 1000, 0, FALSE, FALSE,
 '원본 매입단가: 2.00 USD/kg (KRW 환산값 2,700). 매출단가는 원화 4,000/kg.'),

-- 3. Korea Buyer Co (종료점, 매출가 0)
('90040000-0000-0000-0004-000000000003',
 '90040000-0000-0000-0003-000000000001',
 '90040000-0000-0000-0001-000000000003',
 3, 'BUYER', 'DISTRIBUTOR', 'CREDIT',
 4000, 0, 1000, 0, FALSE, TRUE, NULL);

-- =============================================================================
-- 5. formula_payment_schedules
-- IN : Korea Buyer Co -> GioWorks Import  4,000,000 KRW (CREDIT)
-- OUT: GioWorks Import -> US Supplier Inc 2,700,000 KRW (PREPAYMENT, ENUM 보정)
-- =============================================================================

INSERT INTO formula_payment_schedules (
    id, formula_id, participant_id, direction, payment_type,
    counterparty_company_id, scheduled_amount, scheduled_date, status
) VALUES
('90040000-0000-0000-0005-000000000001',
 '90040000-0000-0000-0003-000000000001',
 '90040000-0000-0000-0004-000000000002',
 'IN', 'CREDIT',
 '90040000-0000-0000-0001-000000000003',
 4000000, '2026-08-15', 'COMPLETED'),

('90040000-0000-0000-0005-000000000002',
 '90040000-0000-0000-0003-000000000001',
 '90040000-0000-0000-0004-000000000002',
 'OUT', 'PREPAYMENT',
 '90040000-0000-0000-0001-000000000001',
 2700000, '2026-08-10', 'COMPLETED');

-- =============================================================================
-- 6. formula_payment_records
-- 두 schedule 모두 전액 1건씩 완료 처리 (trigger: record.direction = schedule.direction 일치 필요)
-- =============================================================================

INSERT INTO formula_payment_records (
    id, formula_id, payment_schedule_id, participant_id, direction,
    counterparty_company_id, actual_amount, actual_date,
    bank_name, account_name, account_no,
    confirmed_by, confirmed_at, status, is_canceled
) VALUES
-- IN: Korea Buyer Co로부터 4,000,000 KRW 입금 완료
('90040000-0000-0000-0006-000000000001',
 '90040000-0000-0000-0003-000000000001',
 '90040000-0000-0000-0005-000000000001',
 '90040000-0000-0000-0004-000000000002',
 'IN',
 '90040000-0000-0000-0001-000000000003',
 4000000, '2026-08-15',
 '신한은행', 'GioWorks Import', '300400-50-600700',
 '윤실무', '2026-08-15 11:30:00+09', 'COMPLETED', FALSE),

-- OUT: US Supplier Inc에게 2,700,000 KRW 지급 완료
('90040000-0000-0000-0006-000000000002',
 '90040000-0000-0000-0003-000000000001',
 '90040000-0000-0000-0005-000000000002',
 '90040000-0000-0000-0004-000000000002',
 'OUT',
 '90040000-0000-0000-0001-000000000001',
 2700000, '2026-08-10',
 '하나은행', 'US Supplier Inc', '400500-60-700800',
 '윤실무', '2026-08-10 09:00:00+09', 'COMPLETED', FALSE);

-- =============================================================================
-- 7. formula_shares — GioWorks 마진 중 셰어 배분 (예상비용/예상셰어 반영용)
-- =============================================================================

INSERT INTO formula_shares (
    id, formula_id, participant_id, target_company_id,
    share_basis, share_method, share_rate, share_amount, memo
) VALUES (
    '90040000-0000-0000-0007-000000000001',
    '90040000-0000-0000-0003-000000000001',
    '90040000-0000-0000-0004-000000000002',
    '90040000-0000-0000-0001-000000000003',
    'PROFIT', 'FIXED_AMOUNT', NULL, 100000,
    'GioWorks Import 마진 중 Korea Buyer Co 인센티브 고정 배분'
);

-- =============================================================================
-- 8. formula_versions + formula_calculation_snapshots
-- 예상순이익(GioWorks 관점, KRW 기준) = 4,000,000 - 2,700,000 - 200,000 - 100,000 = 1,000,000
-- exchange_rate_used = 1,350 (contract_exchange_rate 기준)
-- =============================================================================

INSERT INTO formula_versions (
    id, formula_id, version_no, changed_by, change_reason, snapshot
) VALUES (
    '90040000-0000-0000-0008-000000000001',
    '90040000-0000-0000-0003-000000000001',
    1, 'system_seed', 'TEST-004 초기 등록',
    '{"schema_version": "v1.6.1", "event": "initial_seed", "quantity": 1000, "contract_exchange_rate": 1350, "adjusted_exchange_rate": 1380}'::jsonb
);

INSERT INTO formula_calculation_snapshots (
    id, formula_id, formula_version_id,
    quantity, total_buy_amount, total_sell_amount,
    total_cost, total_share, net_profit, profit_rate,
    exchange_rate_used,
    snapshot_data
) VALUES (
    '90040000-0000-0000-0009-000000000001',
    '90040000-0000-0000-0003-000000000001',
    '90040000-0000-0000-0008-000000000001',
    1000, 2700000, 4000000,
    200000, 100000, 1000000, 25.0000,
    1350,
    '{"basis": "GioWorks 관점, KRW 기준", "formula": "total_sell - total_buy - total_cost - total_share", "exchange_rate_basis": "contract_exchange_rate"}'::jsonb
);

COMMIT;
