-- =============================================================================
-- TOCS TEST-005 Seed Data — 물류비/운송사/운송비 부담주체 검증
-- =============================================================================
-- 거래 흐름: Supplier Logistics Co → GioWorks Logistics → Buyer Logistics Co
-- 품목: Logistics Test Raw Material, 수량 2,000 kg
-- 단가: Supplier(매출1,000) / GioWorks(매입1,000,매출1,800) / Buyer(매입1,800)
-- 운송: carrier=Carrier Logistics Co, departure=Supplier, arrival=Buyer,
--       cost_bearer=GioWorks, total_logistics_cost=300,000
--
-- [ENUM 값 보정 보고 - 설계 우회 아님, 요청서가 명시한 대체 옵션 적용]
-- 요청서가 제시한 값 중 실제 ENUM에 존재하지 않는 것이 2개 있었다.
--
--   1. cost_type = 'COST_EXPENSE'
--      실제 logistics_cost_type ENUM: INCLUDED_IN_BUY_PRICE / INCLUDED_IN_SELL_PRICE / SEPARATE_COST
--      COST_EXPENSE는 존재하지 않음.
--      요청서 문구: "COST_EXPENSE 또는 현재 ENUM에 존재하는 가장 적절한 값 사용"
--      -> 운송비를 별도 OUT record로 지급하는 시나리오이므로 'SEPARATE_COST' 채택.
--
--   2. logistics_status = 'PENDING'
--      logistics_status 컬럼의 실제 타입은 trade_status ENUM(DRAFT/IN_PROGRESS/COMPLETED/CANCELED).
--      PENDING은 payment_status ENUM에만 존재하며 trade_status에는 없음.
--      요청서 문구: "PENDING 또는 IN_PROGRESS"
--      -> 'IN_PROGRESS' 채택.
--
--   참고: payment_type='POST_SETTLEMENT'(출금 Schedule 2)는 실제 ENUM에 그대로 존재하므로 변경 없음.
--
-- 이 두 항목 외에는 요청서 수치/구조를 그대로 따랐다. Seed를 스키마에 맞춰 우회한 부분은 없으며,
-- 모든 값은 요청서가 명시적으로 제공한 대체 옵션 범위 내에서 선택했다.
--
-- 전제: base + supplement + amount_verified fix + TEST-001~004 적용 완료 상태.
-- UUID는 '90050000-...' 패턴으로 기존 75개 UUID와 충돌 없음.
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. companies (4개: Supplier, GioWorks, Buyer, Carrier)
-- =============================================================================

INSERT INTO companies (id, company_name, business_reg_no, representative_name, main_phone, hq_address, is_active) VALUES
('90050000-0000-0000-0001-000000000001', 'Supplier Logistics Co', '907-81-00015', '정물류1', '02-9500-0015', '경기도 평택시 포승읍 1', TRUE),
('90050000-0000-0000-0001-000000000002', 'GioWorks Logistics',    '908-81-00016', '김지오5', '02-9600-0016', '서울시 강남구 삼성로 700', TRUE),
('90050000-0000-0000-0001-000000000003', 'Buyer Logistics Co',    '909-81-00017', '이물류2', '031-700-0017', '경기도 화성시 송산면 2', TRUE),
('90050000-0000-0000-0001-000000000004', 'Carrier Logistics Co',  '910-81-00018', '박운송',  '02-9700-0018', '서울시 중구 통일로 3', TRUE);

-- =============================================================================
-- 2. items
-- =============================================================================

INSERT INTO items (id, item_code, item_name, default_unit, category, is_active) VALUES
('90050000-0000-0000-0002-000000000001', 'ITEM-LOGI-005', 'Logistics Test Raw Material', 'kg', '재활용원료', TRUE);

-- =============================================================================
-- 3. formulas
-- =============================================================================

INSERT INTO formulas (
    id, trade_type, item_id, unit, quantity,
    base_currency,
    content, note,
    trade_status, delivery_status, cash_in_status, cash_out_status,
    invoice_status, logistics_status,
    is_closed, created_by
) VALUES (
    '90050000-0000-0000-0003-000000000001',
    'DOMESTIC',
    '90050000-0000-0000-0002-000000000001',
    'kg',
    2000,
    'KRW',
    'TEST-005: Supplier Logistics Co -> GioWorks Logistics -> Buyer Logistics Co 물류비 검증',
    '운송비 300,000을 GioWorks가 부담. carrier/departure/arrival/cost_bearer 4주체 분리 검증.',
    'IN_PROGRESS',
    'IN_PROGRESS',
    'COMPLETED',   -- cash_in_status: 입금 전액 완료
    'COMPLETED',   -- cash_out_status: 출금(매입대금+운송비) 전액 완료
    'NOT_ISSUED',
    'IN_PROGRESS', -- logistics_status: 요청서의 'PENDING'은 ENUM 미존재 -> 대체옵션 IN_PROGRESS 채택
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
-- 1. Supplier Logistics Co (시작점, 매입가 0)
('90050000-0000-0000-0004-000000000001',
 '90050000-0000-0000-0003-000000000001',
 '90050000-0000-0000-0001-000000000001',
 1, 'SUPPLIER', 'MANUFACTURER', 'PREPAYMENT',
 0, 1000, 2000, 0, TRUE, FALSE),

-- 2. GioWorks Logistics (중간 트레이더)
('90050000-0000-0000-0004-000000000002',
 '90050000-0000-0000-0003-000000000001',
 '90050000-0000-0000-0001-000000000002',
 2, 'BUYER', 'DISTRIBUTOR', 'CREDIT',
 1000, 1800, 2000, 0, FALSE, FALSE),

-- 3. Buyer Logistics Co (종료점, 매출가 0)
('90050000-0000-0000-0004-000000000003',
 '90050000-0000-0000-0003-000000000001',
 '90050000-0000-0000-0001-000000000003',
 3, 'BUYER', 'DISTRIBUTOR', 'CREDIT',
 1800, 0, 2000, 0, FALSE, TRUE);

-- =============================================================================
-- 5. formula_logistics
-- carrier=Carrier Logistics Co, departure=Supplier, arrival=Buyer(직송), cost_bearer=GioWorks
-- cost_type: 요청서의 'COST_EXPENSE'는 ENUM 미존재 -> 대체옵션 'SEPARATE_COST' 채택
--   (운송비를 매입/매출 단가에 포함하지 않고 별도 OUT record로 지급하는 구조와 의미상 일치)
-- =============================================================================

INSERT INTO formula_logistics (
    id, formula_id,
    carrier_company_id, departure_company_id, arrival_company_id, cost_bearer_company_id,
    cost_type,
    departure_location, arrival_location,
    item_description, transport_quantity, vehicle_count,
    total_logistics_cost, scheduled_date
) VALUES (
    '90050000-0000-0000-0005-000000000001',
    '90050000-0000-0000-0003-000000000001',
    '90050000-0000-0000-0001-000000000004',  -- carrier: Carrier Logistics Co
    '90050000-0000-0000-0001-000000000001',  -- departure: Supplier Logistics Co
    '90050000-0000-0000-0001-000000000003',  -- arrival: Buyer Logistics Co (직송)
    '90050000-0000-0000-0001-000000000002',  -- cost_bearer: GioWorks Logistics
    'SEPARATE_COST',
    '경기도 평택시 포승읍 1',
    '경기도 화성시 송산면 2',
    'Logistics Test Raw Material 40톤 벌크',
    2000, 1,
    300000, '2026-09-01'
);

-- =============================================================================
-- 6. formula_payment_schedules
-- IN  : Buyer Logistics Co -> GioWorks Logistics    3,600,000 (CREDIT)
-- OUT1: GioWorks Logistics -> Supplier Logistics Co 2,000,000 (PREPAYMENT, 매입대금)
-- OUT2: GioWorks Logistics -> Carrier Logistics Co     300,000 (POST_SETTLEMENT, 운송비)
-- =============================================================================

INSERT INTO formula_payment_schedules (
    id, formula_id, participant_id, direction, payment_type,
    counterparty_company_id, scheduled_amount, scheduled_date, status
) VALUES
-- IN: Buyer로부터 받을 돈
('90050000-0000-0000-0006-000000000001',
 '90050000-0000-0000-0003-000000000001',
 '90050000-0000-0000-0004-000000000002',
 'IN', 'CREDIT',
 '90050000-0000-0000-0001-000000000003',
 3600000, '2026-09-10', 'COMPLETED'),

-- OUT1: Supplier에게 줄 매입대금
('90050000-0000-0000-0006-000000000002',
 '90050000-0000-0000-0003-000000000001',
 '90050000-0000-0000-0004-000000000002',
 'OUT', 'PREPAYMENT',
 '90050000-0000-0000-0001-000000000001',
 2000000, '2026-08-28', 'COMPLETED'),

-- OUT2: Carrier에게 줄 운송비
('90050000-0000-0000-0006-000000000003',
 '90050000-0000-0000-0003-000000000001',
 '90050000-0000-0000-0004-000000000002',
 'OUT', 'POST_SETTLEMENT',
 '90050000-0000-0000-0001-000000000004',
 300000, '2026-09-02', 'COMPLETED');

-- =============================================================================
-- 7. formula_payment_records
-- 각 schedule마다 1건씩 전액 완료 (트리거: record.direction = schedule.direction 일치 필요)
-- =============================================================================

-- IN: Buyer로부터 3,600,000 입금 완료
INSERT INTO formula_payment_records (
    id, formula_id, payment_schedule_id, participant_id, direction,
    counterparty_company_id, actual_amount, actual_date,
    bank_name, account_name, account_no,
    confirmed_by, confirmed_at, status, is_canceled
) VALUES (
    '90050000-0000-0000-0007-000000000001',
    '90050000-0000-0000-0003-000000000001',
    '90050000-0000-0000-0006-000000000001',
    '90050000-0000-0000-0004-000000000002',
    'IN',
    '90050000-0000-0000-0001-000000000003',
    3600000, '2026-09-10',
    '농협은행', 'GioWorks Logistics', '500600-70-800900',
    '서실무', '2026-09-10 13:00:00+09', 'COMPLETED', FALSE
);

-- OUT1: Supplier에게 2,000,000 매입대금 지급 완료
INSERT INTO formula_payment_records (
    id, formula_id, payment_schedule_id, participant_id, direction,
    counterparty_company_id, actual_amount, actual_date,
    bank_name, account_name, account_no,
    confirmed_by, confirmed_at, status, is_canceled
) VALUES (
    '90050000-0000-0000-0007-000000000002',
    '90050000-0000-0000-0003-000000000001',
    '90050000-0000-0000-0006-000000000002',
    '90050000-0000-0000-0004-000000000002',
    'OUT',
    '90050000-0000-0000-0001-000000000001',
    2000000, '2026-08-28',
    '기업은행', 'Supplier Logistics Co', '600700-80-900100',
    '서실무', '2026-08-28 10:00:00+09', 'COMPLETED', FALSE
);

-- OUT2: Carrier에게 300,000 운송비 지급 완료 (이 record가 확정순이익에 반영되는지가 핵심 검증)
INSERT INTO formula_payment_records (
    id, formula_id, payment_schedule_id, participant_id, direction,
    counterparty_company_id, actual_amount, actual_date,
    bank_name, account_name, account_no,
    confirmed_by, confirmed_at, status, is_canceled, memo
) VALUES (
    '90050000-0000-0000-0007-000000000003',
    '90050000-0000-0000-0003-000000000001',
    '90050000-0000-0000-0006-000000000003',
    '90050000-0000-0000-0004-000000000002',
    'OUT',
    '90050000-0000-0000-0001-000000000004',
    300000, '2026-09-02',
    '기업은행', 'Carrier Logistics Co', '700800-90-100200',
    '서실무', '2026-09-02 15:00:00+09', 'COMPLETED', FALSE,
    '운송비 지급 - 확정순이익(실출금) 반영 검증용'
);

-- =============================================================================
-- 8. formula_shares — GioWorks 마진 중 셰어 배분 (예상비용/예상셰어 반영용)
-- =============================================================================

INSERT INTO formula_shares (
    id, formula_id, participant_id, target_company_id,
    share_basis, share_method, share_rate, share_amount, memo
) VALUES (
    '90050000-0000-0000-0008-000000000001',
    '90050000-0000-0000-0003-000000000001',
    '90050000-0000-0000-0004-000000000002',
    '90050000-0000-0000-0001-000000000003',
    'PROFIT', 'FIXED_AMOUNT', NULL, 100000,
    'GioWorks Logistics 마진 중 Buyer 인센티브 고정 배분'
);

-- =============================================================================
-- 9. formula_versions + formula_calculation_snapshots
-- 예상순이익(GioWorks 관점) = 3,600,000 - 2,000,000 - 300,000(운송비) - 100,000(셰어) = 1,200,000
-- =============================================================================

INSERT INTO formula_versions (
    id, formula_id, version_no, changed_by, change_reason, snapshot
) VALUES (
    '90050000-0000-0000-0009-000000000001',
    '90050000-0000-0000-0003-000000000001',
    1, 'system_seed', 'TEST-005 초기 등록',
    '{"schema_version": "v1.6.1", "event": "initial_seed", "quantity": 2000}'::jsonb
);

INSERT INTO formula_calculation_snapshots (
    id, formula_id, formula_version_id,
    quantity, total_buy_amount, total_sell_amount,
    total_cost, total_share, net_profit, profit_rate,
    snapshot_data
) VALUES (
    '90050000-0000-0000-0010-000000000001',
    '90050000-0000-0000-0003-000000000001',
    '90050000-0000-0000-0009-000000000001',
    2000, 2000000, 3600000,
    300000, 100000, 1200000, 33.3333,
    '{"basis": "GioWorks 관점", "formula": "total_sell - total_buy - total_cost(운송비) - total_share"}'::jsonb
);

COMMIT;
