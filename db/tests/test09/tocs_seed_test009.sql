-- =============================================================================
-- TOCS TEST-009 Seed Data — Formula Version Engine 검증
-- =============================================================================
-- 거래: Supplier Version Co -> GioWorks Version -> Buyer Version Co
-- V1: buy=1,000,000 / sell=2,000,000 / expected_profit=1,000,000
-- V2: buy=1,200,000 / sell=2,000,000 / expected_profit=800,000 (단가 변경)
--
-- [설계 판단 - 우회 아님]
-- formula_participants는 "현재 상태"만 보관하므로 V1->V2 전환 시 UPDATE가 필요하다.
-- formula_versions.snapshot(JSONB)이 변경 직전 상태를 영구 보존하고,
-- formula_calculation_snapshots는 매 버전 시점의 계산 결과를 누적 INSERT한다.
-- (Master Spec 5절: "기존 데이터 수정 금지 -> 신규 버전 생성, 기존 버전은
--  스냅샷 상태로 영구 보존"의 의미는 version/snapshot 테이블의 이력 보존이며,
--  participants 테이블 자체의 불변을 의미하지 않는다.)
--
-- [복합 FK 정합성]
-- formula_calculation_snapshots.formula_version_id는 (formula_version_id, formula_id)
-- 복합 FK로 formula_versions(id, formula_id)를 참조한다(MATCH SIMPLE).
-- V1 snapshot은 V1.id, V2 snapshot은 V2.id를 정확히 매핑해야 한다.
--
-- 전제: base + supplement + amount_verified fix + TEST-001~008 적용 완료 상태.
-- UUID는 '90090000-...' 패턴으로 기존 159개 UUID와 충돌 없음.
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. companies
-- =============================================================================

INSERT INTO companies (id, company_name, business_reg_no, representative_name, main_phone, hq_address, is_active) VALUES
('90090000-0000-0000-0001-000000000001', 'Supplier Version Co', '923-81-00031', '정버전1', '02-1201-0031', '서울시 노원구 동일로 1', TRUE),
('90090000-0000-0000-0001-000000000002', 'GioWorks Version',    '924-81-00032', '김지오9', '02-1202-0032', '서울시 강남구 선릉로 2', TRUE),
('90090000-0000-0000-0001-000000000003', 'Buyer Version Co',    '925-81-00033', '이버전2', '031-1100-0033', '경기도 고양시 일산동구 3', TRUE);

-- =============================================================================
-- 2. items
-- =============================================================================

INSERT INTO items (id, item_code, item_name, default_unit, category, is_active) VALUES
('90090000-0000-0000-0002-000000000001', 'ITEM-VERSION-009', 'Version Test Raw Material', 'kg', '재활용원료', TRUE);

-- =============================================================================
-- 3. formulas
-- formula_no는 DEFAULT 자동 채번 사용 (TEST-008에서 확정한 정책 그대로 유지).
-- =============================================================================

INSERT INTO formulas (
    id, trade_type, item_id, unit, quantity,
    base_currency,
    content, note,
    trade_status, delivery_status, cash_in_status, cash_out_status,
    invoice_status, logistics_status,
    is_closed, created_by
) VALUES (
    '90090000-0000-0000-0003-000000000001',
    'DOMESTIC',
    '90090000-0000-0000-0002-000000000001',
    'kg',
    1000,
    'KRW',
    'TEST-009: Supplier Version Co -> GioWorks Version -> Buyer Version Co Version Engine 검증',
    'V1(buy=1,000,000) -> V2(buy=1,200,000) 단가 변경에 따른 Version 증가,
Snapshot 분리 보존, Audit Log 기록 검증. formula_no가 버전 변경에도 유지되는지 확인.',
    'IN_PROGRESS',
    'IN_PROGRESS',
    'PENDING',
    'PENDING',
    'NOT_ISSUED',
    'DRAFT',
    FALSE,
    'system_seed'
);

-- =============================================================================
-- 4. formula_participants — V1 상태로 최초 등록 (buy_unit_price=1,000)
-- sell=2,000,000은 buy와 무관하게 V1/V2 전체에서 고정 (시나리오상 매출 불변)
-- =============================================================================

INSERT INTO formula_participants (
    id, formula_id, company_id, sequence_order,
    role_group, nature_group, payment_group,
    buy_unit_price, sell_unit_price, quantity,
    direct_cost_amount,
    is_start_point, is_end_point
) VALUES
('90090000-0000-0000-0004-000000000001',
 '90090000-0000-0000-0003-000000000001',
 '90090000-0000-0000-0001-000000000001',
 1, 'SUPPLIER', 'MANUFACTURER', 'PREPAYMENT',
 0, 1000, 1000, 0, TRUE, FALSE),

('90090000-0000-0000-0004-000000000002',
 '90090000-0000-0000-0003-000000000001',
 '90090000-0000-0000-0001-000000000002',
 2, 'BUYER', 'DISTRIBUTOR', 'CREDIT',
 1000, 2000, 1000, 0, FALSE, FALSE),

('90090000-0000-0000-0004-000000000003',
 '90090000-0000-0000-0003-000000000001',
 '90090000-0000-0000-0001-000000000003',
 3, 'BUYER', 'DISTRIBUTOR', 'CREDIT',
 2000, 0, 1000, 0, FALSE, TRUE);

-- =============================================================================
-- 5. formula_payment_schedules / records / invoices / logistics / shares
-- Version 증가가 이 데이터들을 손상시키지 않는지 검증하기 위한 최소 구성.
-- 입금 schedule 1건만 두고 record는 아직 없는 상태(외상)로 단순화하여,
-- Version 변경 전후로 이 데이터가 그대로 남아있는지를 검증의 핵심으로 둔다.
-- =============================================================================

INSERT INTO formula_payment_schedules (
    id, formula_id, participant_id, direction, payment_type,
    counterparty_company_id, scheduled_amount, scheduled_date, status
) VALUES (
    '90090000-0000-0000-0005-000000000001',
    '90090000-0000-0000-0003-000000000001',
    '90090000-0000-0000-0004-000000000002',
    'IN', 'CREDIT',
    '90090000-0000-0000-0001-000000000003',
    2000000, '2026-10-20', 'PENDING'
);

INSERT INTO formula_invoices (
    id, formula_id, issuer_company_id, receiver_company_id,
    issuer_participant_id, receiver_participant_id, sequence_order,
    invoice_no, invoice_date,
    supply_amount, tax_amount,
    status, memo
) VALUES (
    '90090000-0000-0000-0006-000000000001',
    '90090000-0000-0000-0003-000000000001',
    '90090000-0000-0000-0001-000000000002',
    '90090000-0000-0000-0001-000000000003',
    '90090000-0000-0000-0004-000000000002',
    '90090000-0000-0000-0004-000000000003',
    1,
    'INV-VERSION-2026-0001', '2026-10-18',
    2000000, 0,
    'NOT_ISSUED',
    'Version 변경 전후 데이터 무결성 검증용 계산서'
);

INSERT INTO formula_logistics (
    id, formula_id,
    carrier_company_id, departure_company_id, arrival_company_id, cost_bearer_company_id,
    cost_type,
    departure_location, arrival_location,
    item_description, transport_quantity, vehicle_count,
    total_logistics_cost, scheduled_date
) VALUES (
    '90090000-0000-0000-0007-000000000001',
    '90090000-0000-0000-0003-000000000001',
    '90090000-0000-0000-0001-000000000002',
    '90090000-0000-0000-0001-000000000001',
    '90090000-0000-0000-0001-000000000003',
    '90090000-0000-0000-0001-000000000002',
    'SEPARATE_COST',
    '서울시 노원구 동일로 1',
    '경기도 고양시 일산동구 3',
    'Version Test Raw Material 15톤 벌크',
    1000, 1,
    0, '2026-10-22'
);

INSERT INTO formula_shares (
    id, formula_id, participant_id, target_company_id,
    share_basis, share_method, share_rate, share_amount, memo
) VALUES (
    '90090000-0000-0000-0008-000000000001',
    '90090000-0000-0000-0003-000000000001',
    '90090000-0000-0000-0004-000000000002',
    '90090000-0000-0000-0001-000000000003',
    'DIRECT', 'FIXED_AMOUNT', NULL, 0,
    'Version 변경 전후 데이터 무결성 검증용 셰어(0원, 영향 없음 확인 목적)'
);

-- =============================================================================
-- 6. formula_versions V1 + formula_calculation_snapshots V1
-- V1: buy=1,000,000, sell=2,000,000, profit=1,000,000
-- =============================================================================

INSERT INTO formula_versions (
    id, formula_id, version_no, changed_by, change_reason, snapshot
) VALUES (
    '90090000-0000-0000-0009-000000000001',
    '90090000-0000-0000-0003-000000000001',
    1, 'system_seed', 'TEST-009 V1 초기 등록',
    '{"schema_version": "v1.6.1", "event": "initial_seed", "version_no": 1,
      "quantity": 1000, "buy_unit_price": 1000, "sell_unit_price": 2000,
      "total_buy_amount": 1000000, "total_sell_amount": 2000000}'::jsonb
);

INSERT INTO formula_calculation_snapshots (
    id, formula_id, formula_version_id,
    quantity, total_buy_amount, total_sell_amount,
    total_cost, total_share, net_profit, profit_rate,
    snapshot_data
) VALUES (
    '90090000-0000-0000-0010-000000000001',
    '90090000-0000-0000-0003-000000000001',
    '90090000-0000-0000-0009-000000000001',
    1000, 1000000, 2000000,
    0, 0, 1000000, 50.0000,
    '{"version_no": 1, "basis": "GioWorks 관점", "formula": "total_sell - total_buy - total_cost(0) - total_share(0)"}'::jsonb
);

-- =============================================================================
-- 7. Version 2 전환
-- Step 1: formula_participants.buy_unit_price를 1,000 -> 1,200으로 UPDATE
--         (quantity=1000 고정이므로 GENERATED total_buy_amount가 자동으로
--          1,000,000 -> 1,200,000으로 재계산됨)
-- Step 2: formula_versions에 V2 신규 INSERT (V1 row는 그대로 보존, UPDATE 안 함)
-- Step 3: formula_calculation_snapshots에 V2 신규 INSERT (V1 snapshot도 보존)
-- Step 4: audit_logs에 변경 사유 기록
-- =============================================================================

UPDATE formula_participants
SET buy_unit_price = 1200,
    updated_at = NOW()
WHERE id = '90090000-0000-0000-0004-000000000002';

INSERT INTO formula_versions (
    id, formula_id, version_no, changed_by, change_reason, snapshot
) VALUES (
    '90090000-0000-0000-0009-000000000002',
    '90090000-0000-0000-0003-000000000001',
    2, 'system_seed', 'TEST-009 V2: 매입단가 변경 1,000 -> 1,200 (공급사 단가 인상 반영)',
    '{"schema_version": "v1.6.1", "event": "version_increment", "version_no": 2,
      "quantity": 1000, "buy_unit_price": 1200, "sell_unit_price": 2000,
      "total_buy_amount": 1200000, "total_sell_amount": 2000000,
      "previous_version_no": 1}'::jsonb
);

INSERT INTO formula_calculation_snapshots (
    id, formula_id, formula_version_id,
    quantity, total_buy_amount, total_sell_amount,
    total_cost, total_share, net_profit, profit_rate,
    snapshot_data
) VALUES (
    '90090000-0000-0000-0010-000000000002',
    '90090000-0000-0000-0003-000000000001',
    '90090000-0000-0000-0009-000000000002',
    1000, 1200000, 2000000,
    0, 0, 800000, 40.0000,
    '{"version_no": 2, "basis": "GioWorks 관점", "formula": "total_sell - total_buy - total_cost(0) - total_share(0)"}'::jsonb
);

-- =============================================================================
-- 8. audit_logs — Version 생성 시점 및 변경 사유 기록
-- =============================================================================

INSERT INTO audit_logs (
    id, table_name, record_id, action, changed_by, old_data, new_data
) VALUES (
    '90090000-0000-0000-0011-000000000001',
    'formula_participants',
    '90090000-0000-0000-0004-000000000002',
    'VERSION_CREATE',
    'system_seed',
    '{"version_no": 1, "buy_unit_price": 1000, "total_buy_amount": 1000000}'::jsonb,
    '{"version_no": 2, "buy_unit_price": 1200, "total_buy_amount": 1200000,
      "change_reason": "공급사 단가 인상 반영"}'::jsonb
);

COMMIT;
