-- =============================================================================
-- TOCS TEST-006 Seed Data — Formula 종결(CLOSE) 검증
-- =============================================================================
-- 거래 흐름: Supplier Close Co → GioWorks Close → Buyer Close Co
-- 품목: Close Test Raw Material, 수량 1,000 kg
-- 단가: Supplier(매출1,000) / GioWorks(매입1,000,매출1,500) / Buyer(매입1,500)
--
-- [구조적 사실 보고 - 결함 아님, 기존 설계 정책의 직접적 결과]
-- formulas.invoice_status 컬럼을 자동으로 갱신하는 트리거/함수는 DB에 존재하지 않는다.
-- (trg_sync_invoice_amount_verified는 formula_invoices.amount_verified만 자동 계산하며,
--  formulas.invoice_status 전환은 v1.6.1 설계 당시 "API 레이어가 v_formula_invoice_status를
--  참고해 수동 결정"하기로 명시적으로 정책화되어 있다.)
-- 따라서 이 Seed는 formulas.invoice_status = 'AMOUNT_MATCHED'를 INSERT 시점에 직접 명시한다.
-- 이는 우회가 아니라, 트리거 없는 일반 컬럼에 대한 정상적인 값 지정이다.
-- (참고: formula_invoices.status는 별도 컬럼이며 각 계산서마다 개별적으로 'AMOUNT_MATCHED'를 명시함)
--
-- [숫자 특이사항 보고]
-- 이번 시나리오는 예상비용=0, 예상셰어=0이므로 확정순이익(500,000)과 예상순이익(500,000)이
-- 우연히 같은 값으로 나온다. 이는 TEST-004/005에서 검증한 "확정≠예상 분리 원칙"의 위반이 아니라,
-- 비용/셰어가 0인 특수 케이스의 산술적 결과일 뿐이다. (확정과 예상은 여전히 서로 다른 계산
-- 경로를 거쳐 독립적으로 산출되며, 우연히 같은 결과값에 도달한 것뿐이다.)
--
-- 전제: base + supplement + amount_verified fix + TEST-001~005 적용 완료 상태.
-- UUID는 '90060000-...' 패턴으로 기존 94개 UUID와 충돌 없음.
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. companies (4개: Supplier, GioWorks, Buyer, Carrier)
-- =============================================================================

INSERT INTO companies (id, company_name, business_reg_no, representative_name, main_phone, hq_address, is_active) VALUES
('90060000-0000-0000-0001-000000000001', 'Supplier Close Co', '911-81-00019', '정클로즈1', '02-9800-0019', '서울시 구로구 디지털로 1', TRUE),
('90060000-0000-0000-0001-000000000002', 'GioWorks Close',    '912-81-00020', '김지오6',   '02-9900-0020', '서울시 강남구 도곡로 2', TRUE),
('90060000-0000-0000-0001-000000000003', 'Buyer Close Co',    '913-81-00021', '이클로즈2', '031-800-0021', '경기도 성남시 분당구 3', TRUE),
('90060000-0000-0000-0001-000000000004', 'Carrier Close Co',  '914-81-00022', '박클로즈3', '02-9999-0022', '서울시 중구 청계천로 4', TRUE);

-- =============================================================================
-- 2. items
-- =============================================================================

INSERT INTO items (id, item_code, item_name, default_unit, category, is_active) VALUES
('90060000-0000-0000-0002-000000000001', 'ITEM-CLOSE-006', 'Close Test Raw Material', 'kg', '재활용원료', TRUE);

-- =============================================================================
-- 3. formulas
-- 6개 상태 모두 종결 조건을 만족하는 값으로 INSERT 시점에 직접 명시.
-- is_closed=TRUE, closed_at=NOW()도 동시에 INSERT하여
-- chk_closed_requires_all_completed + chk_closed_at_consistency를 한 번에 통과시킨다.
-- =============================================================================

INSERT INTO formulas (
    id, trade_type, item_id, unit, quantity,
    base_currency,
    content, note,
    trade_status, delivery_status, cash_in_status, cash_out_status,
    invoice_status, logistics_status,
    is_closed, closed_at, created_by
) VALUES (
    '90060000-0000-0000-0003-000000000001',
    'DOMESTIC',
    '90060000-0000-0000-0002-000000000001',
    'kg',
    1000,
    'KRW',
    'TEST-006: Supplier Close Co -> GioWorks Close -> Buyer Close Co 종결(CLOSE) 검증',
    '6개 상태 모두 완료 + is_closed=TRUE + closed_at NOT NULL 정합성 검증',
    'COMPLETED',
    'COMPLETED',
    'COMPLETED',
    'COMPLETED',
    'AMOUNT_MATCHED',
    'COMPLETED',
    TRUE, NOW(),
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
('90060000-0000-0000-0004-000000000001',
 '90060000-0000-0000-0003-000000000001',
 '90060000-0000-0000-0001-000000000001',
 1, 'SUPPLIER', 'MANUFACTURER', 'PREPAYMENT',
 0, 1000, 1000, 0, TRUE, FALSE),

('90060000-0000-0000-0004-000000000002',
 '90060000-0000-0000-0003-000000000001',
 '90060000-0000-0000-0001-000000000002',
 2, 'BUYER', 'DISTRIBUTOR', 'CREDIT',
 1000, 1500, 1000, 0, FALSE, FALSE),

('90060000-0000-0000-0004-000000000003',
 '90060000-0000-0000-0003-000000000001',
 '90060000-0000-0000-0001-000000000003',
 3, 'BUYER', 'DISTRIBUTOR', 'CREDIT',
 1500, 0, 1000, 0, FALSE, TRUE);

-- =============================================================================
-- 5. formula_logistics
-- total_logistics_cost=0 이므로 chk_logistics_cost_bearer는 OR 좌측(=0)으로 이미 통과.
-- cost_bearer_company_id를 명시해도 제약 위반 없음(둘 다 만족).
-- =============================================================================

INSERT INTO formula_logistics (
    id, formula_id,
    carrier_company_id, departure_company_id, arrival_company_id, cost_bearer_company_id,
    cost_type,
    departure_location, arrival_location,
    item_description, transport_quantity, vehicle_count,
    total_logistics_cost, scheduled_date
) VALUES (
    '90060000-0000-0000-0005-000000000001',
    '90060000-0000-0000-0003-000000000001',
    '90060000-0000-0000-0001-000000000004',  -- carrier: Carrier Close Co
    '90060000-0000-0000-0001-000000000001',  -- departure: Supplier Close Co
    '90060000-0000-0000-0001-000000000003',  -- arrival: Buyer Close Co
    '90060000-0000-0000-0001-000000000002',  -- cost_bearer: GioWorks Close
    'INCLUDED_IN_SELL_PRICE',
    '서울시 구로구 디지털로 1',
    '경기도 성남시 분당구 3',
    'Close Test Raw Material 20톤 벌크',
    1000, 1,
    0, '2026-09-15'
);

-- =============================================================================
-- 6. formula_payment_schedules
-- IN : Buyer Close Co -> GioWorks Close 1,500,000 (CREDIT)
-- OUT: GioWorks Close -> Supplier Close Co 1,000,000 (PREPAYMENT)
-- 둘 다 전액 완료이므로 status='COMPLETED'로 직접 명시
-- =============================================================================

INSERT INTO formula_payment_schedules (
    id, formula_id, participant_id, direction, payment_type,
    counterparty_company_id, scheduled_amount, scheduled_date, status
) VALUES
('90060000-0000-0000-0006-000000000001',
 '90060000-0000-0000-0003-000000000001',
 '90060000-0000-0000-0004-000000000002',
 'IN', 'CREDIT',
 '90060000-0000-0000-0001-000000000003',
 1500000, '2026-09-20', 'COMPLETED'),

('90060000-0000-0000-0006-000000000002',
 '90060000-0000-0000-0003-000000000001',
 '90060000-0000-0000-0004-000000000002',
 'OUT', 'PREPAYMENT',
 '90060000-0000-0000-0001-000000000001',
 1000000, '2026-09-18', 'COMPLETED');

-- =============================================================================
-- 7. formula_payment_records
-- 각 schedule마다 1건씩 전액 완료 (트리거: record.direction = schedule.direction 일치 필요)
-- =============================================================================

INSERT INTO formula_payment_records (
    id, formula_id, payment_schedule_id, participant_id, direction,
    counterparty_company_id, actual_amount, actual_date,
    bank_name, account_name, account_no,
    confirmed_by, confirmed_at, status, is_canceled
) VALUES (
    '90060000-0000-0000-0007-000000000001',
    '90060000-0000-0000-0003-000000000001',
    '90060000-0000-0000-0006-000000000001',
    '90060000-0000-0000-0004-000000000002',
    'IN',
    '90060000-0000-0000-0001-000000000003',
    1500000, '2026-09-20',
    '국민은행', 'GioWorks Close', '800900-10-200300',
    '문실무', '2026-09-20 14:00:00+09', 'COMPLETED', FALSE
);

INSERT INTO formula_payment_records (
    id, formula_id, payment_schedule_id, participant_id, direction,
    counterparty_company_id, actual_amount, actual_date,
    bank_name, account_name, account_no,
    confirmed_by, confirmed_at, status, is_canceled
) VALUES (
    '90060000-0000-0000-0007-000000000002',
    '90060000-0000-0000-0003-000000000001',
    '90060000-0000-0000-0006-000000000002',
    '90060000-0000-0000-0004-000000000002',
    'OUT',
    '90060000-0000-0000-0001-000000000001',
    1000000, '2026-09-18',
    '신한은행', 'Supplier Close Co', '900100-20-300400',
    '문실무', '2026-09-18 09:30:00+09', 'COMPLETED', FALSE
);

-- =============================================================================
-- 8. formula_invoices
-- 두 계산서 모두 supply=금액, tax=0으로 단순화하여 external_invoice_amount와
-- total_amount(GENERATED)를 정확히 일치시킴 -> trg_sync_invoice_amount_verified가
-- amount_verified=TRUE를 자동 산출하도록 설계.
-- status='AMOUNT_MATCHED'는 직접 명시 (이 컬럼은 트리거가 건드리지 않는 별도 컬럼).
-- =============================================================================

-- INV-1: Supplier Close Co -> GioWorks Close
INSERT INTO formula_invoices (
    id, formula_id, issuer_company_id, receiver_company_id,
    issuer_participant_id, receiver_participant_id, sequence_order,
    invoice_no, invoice_date,
    external_invoice_amount, supply_amount, tax_amount,
    status, memo
) VALUES (
    '90060000-0000-0000-0008-000000000001',
    '90060000-0000-0000-0003-000000000001',
    '90060000-0000-0000-0001-000000000001',
    '90060000-0000-0000-0001-000000000002',
    '90060000-0000-0000-0004-000000000001',
    '90060000-0000-0000-0004-000000000002',
    1,
    'INV-SUP-2026-0918', '2026-09-18',
    1000000, 1000000, 0,
    'AMOUNT_MATCHED',
    '매입 계산서 - 금액 일치'
);

-- INV-2: GioWorks Close -> Buyer Close Co
INSERT INTO formula_invoices (
    id, formula_id, issuer_company_id, receiver_company_id,
    issuer_participant_id, receiver_participant_id, sequence_order,
    invoice_no, invoice_date,
    external_invoice_amount, supply_amount, tax_amount,
    status, memo
) VALUES (
    '90060000-0000-0000-0008-000000000002',
    '90060000-0000-0000-0003-000000000001',
    '90060000-0000-0000-0001-000000000002',
    '90060000-0000-0000-0001-000000000003',
    '90060000-0000-0000-0004-000000000002',
    '90060000-0000-0000-0004-000000000003',
    2,
    'INV-GW-2026-0920', '2026-09-20',
    1500000, 1500000, 0,
    'AMOUNT_MATCHED',
    '매출 계산서 - 금액 일치'
);

-- =============================================================================
-- 9. formula_versions + formula_calculation_snapshots
-- 예상순이익(GioWorks 관점) = 1,500,000 - 1,000,000 - 0 - 0 = 500,000
-- =============================================================================

INSERT INTO formula_versions (
    id, formula_id, version_no, changed_by, change_reason, snapshot
) VALUES (
    '90060000-0000-0000-0009-000000000001',
    '90060000-0000-0000-0003-000000000001',
    1, 'system_seed', 'TEST-006 초기 등록',
    '{"schema_version": "v1.6.1", "event": "initial_seed", "quantity": 1000}'::jsonb
);

INSERT INTO formula_calculation_snapshots (
    id, formula_id, formula_version_id,
    quantity, total_buy_amount, total_sell_amount,
    total_cost, total_share, net_profit, profit_rate,
    snapshot_data
) VALUES (
    '90060000-0000-0000-0010-000000000001',
    '90060000-0000-0000-0003-000000000001',
    '90060000-0000-0000-0009-000000000001',
    1000, 1000000, 1500000,
    0, 0, 500000, 33.3333,
    '{"basis": "GioWorks 관점", "formula": "total_sell - total_buy - total_cost(0) - total_share(0)"}'::jsonb
);

-- =============================================================================
-- 10. formula_status_logs + audit_logs (종결 처리 이력 기록 - 정책상 동시 생성 필수)
-- =============================================================================

INSERT INTO formula_status_logs (
    id, formula_id, status_target, prev_status, new_status, changed_by, change_reason
) VALUES
('90060000-0000-0000-0011-000000000001', '90060000-0000-0000-0003-000000000001',
 'TRADE_STATUS', 'IN_PROGRESS', 'COMPLETED', 'system_seed', 'TEST-006 거래 완료 처리'),
('90060000-0000-0000-0011-000000000002', '90060000-0000-0000-0003-000000000001',
 'DELIVERY_STATUS', 'IN_PROGRESS', 'COMPLETED', 'system_seed', 'TEST-006 수령 완료 처리'),
('90060000-0000-0000-0011-000000000003', '90060000-0000-0000-0003-000000000001',
 'CASH_IN_STATUS', 'PARTIAL', 'COMPLETED', 'system_seed', 'TEST-006 입금 완료 처리'),
('90060000-0000-0000-0011-000000000004', '90060000-0000-0000-0003-000000000001',
 'CASH_OUT_STATUS', 'PARTIAL', 'COMPLETED', 'system_seed', 'TEST-006 출금 완료 처리'),
('90060000-0000-0000-0011-000000000005', '90060000-0000-0000-0003-000000000001',
 'INVOICE_STATUS', 'ISSUED', 'AMOUNT_MATCHED', 'system_seed', 'TEST-006 계산서 매칭 완료'),
('90060000-0000-0000-0011-000000000006', '90060000-0000-0000-0003-000000000001',
 'LOGISTICS_STATUS', 'IN_PROGRESS', 'COMPLETED', 'system_seed', 'TEST-006 운송 완료 처리');

INSERT INTO audit_logs (
    id, table_name, record_id, action, changed_by, old_data, new_data
) VALUES (
    '90060000-0000-0000-0012-000000000001',
    'formulas',
    '90060000-0000-0000-0003-000000000001',
    'STATUS_CHANGE',
    'system_seed',
    '{"is_closed": false, "closed_at": null}'::jsonb,
    '{"is_closed": true, "closed_at": "now"}'::jsonb
);

COMMIT;
