-- =============================================================================
-- TOCS TEST-003 Seed Data — 외상거래(Credit) 검증
-- =============================================================================
-- 거래 흐름: Supplier Credit Co → GioWorks Credit → Buyer Credit Co
-- 품목: Credit Raw Material, 수량 5,000 kg
-- 단가: Supplier(매출400) / GioWorks(매입400,매출650) / Buyer(매입650)
--
-- 검증 목적:
--   schedule만 존재하고 record가 전혀 없는 순수 외상거래 상태에서
--   v_formula_confirmed_kpi / v_formula_profit_engine / v_participant_confirmed_kpi /
--   v_payment_unmatched / v_formula_closeable 가 모두 올바른 0/NULL/예정값을 산출하는지 검증.
--
-- 전제: base + supplement + amount_verified fix + TEST-001 + TEST-002 적용 완료 상태.
-- UUID는 '90030000-...' 패턴으로 TEST-001/002(0~f 단일 prefix 시리즈)와 충돌 없음.
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. companies
-- =============================================================================

INSERT INTO companies (id, company_name, business_reg_no, representative_name, main_phone, hq_address, is_active) VALUES
('90030000-0000-0000-0001-000000000001', 'Supplier Credit Co', '901-81-00009', '정서플라이', '02-9000-0009', '서울시 영등포구 여의대로 50', TRUE),
('90030000-0000-0000-0001-000000000002', 'GioWorks Credit',    '902-81-00010', '김지오3',    '02-9100-0010', '서울시 강남구 논현로 60', TRUE),
('90030000-0000-0000-0001-000000000003', 'Buyer Credit Co',    '903-81-00011', '최바이어',   '02-9200-0011', '서울시 서초구 강남대로 70', TRUE);

-- =============================================================================
-- 2. items
-- =============================================================================

INSERT INTO items (id, item_code, item_name, default_unit, category, is_active) VALUES
('90030000-0000-0000-0002-000000000001', 'ITEM-CREDIT-003', 'Credit Raw Material', 'kg', '재활용원료', TRUE);

-- =============================================================================
-- 3. formulas
-- 입출금 모두 미완료(PENDING) 상태로 시작 (record가 전혀 없으므로 당연히 PENDING)
-- =============================================================================

INSERT INTO formulas (
    id, trade_type, item_id, unit, quantity,
    base_currency,
    content, note,
    trade_status, delivery_status, cash_in_status, cash_out_status,
    invoice_status, logistics_status,
    is_closed, created_by
) VALUES (
    '90030000-0000-0000-0003-000000000001',
    'DOMESTIC',
    '90030000-0000-0000-0002-000000000001',
    'kg',
    5000,
    'KRW',
    'TEST-003: Supplier Credit Co -> GioWorks Credit -> Buyer Credit Co 외상거래 검증',
    'schedule만 존재, record 없음. 순수 외상(CREDIT) 상태 KPI 검증용.',
    'IN_PROGRESS',
    'IN_PROGRESS',
    'PENDING',   -- cash_in_status: 입금 시도 자체가 없음
    'PENDING',   -- cash_out_status: 출금 시도 자체가 없음
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
-- 1. Supplier Credit Co (시작점, 매입가 0)
('90030000-0000-0000-0004-000000000001',
 '90030000-0000-0000-0003-000000000001',
 '90030000-0000-0000-0001-000000000001',
 1, 'SUPPLIER', 'MANUFACTURER', 'CREDIT',
 0, 400, 5000, 0, TRUE, FALSE),

-- 2. GioWorks Credit (중간 트레이더)
('90030000-0000-0000-0004-000000000002',
 '90030000-0000-0000-0003-000000000001',
 '90030000-0000-0000-0001-000000000002',
 2, 'BUYER', 'DISTRIBUTOR', 'CREDIT',
 400, 650, 5000, 0, FALSE, FALSE),

-- 3. Buyer Credit Co (종료점, 매출가 0)
('90030000-0000-0000-0004-000000000003',
 '90030000-0000-0000-0003-000000000001',
 '90030000-0000-0000-0001-000000000003',
 3, 'BUYER', 'DISTRIBUTOR', 'CREDIT',
 650, 0, 5000, 0, FALSE, TRUE);

-- =============================================================================
-- 5. formula_payment_schedules
-- IN : Buyer Credit Co -> GioWorks Credit  3,250,000 (CREDIT, record 없음)
-- OUT: GioWorks Credit -> Supplier Credit Co 2,000,000 (CREDIT, record 없음)
-- =============================================================================

INSERT INTO formula_payment_schedules (
    id, formula_id, participant_id, direction, payment_type,
    counterparty_company_id, scheduled_amount, scheduled_date, status
) VALUES
-- IN schedule (GioWorks Credit participant 기준, Buyer Credit Co로부터 받을 돈)
('90030000-0000-0000-0005-000000000001',
 '90030000-0000-0000-0003-000000000001',
 '90030000-0000-0000-0004-000000000002',
 'IN', 'CREDIT',
 '90030000-0000-0000-0001-000000000003',
 3250000, '2026-08-31', 'PENDING'),

-- OUT schedule (GioWorks Credit participant 기준, Supplier Credit Co에게 줄 돈)
('90030000-0000-0000-0005-000000000002',
 '90030000-0000-0000-0003-000000000001',
 '90030000-0000-0000-0004-000000000002',
 'OUT', 'CREDIT',
 '90030000-0000-0000-0001-000000000001',
 2000000, '2026-08-31', 'PENDING');

-- =============================================================================
-- 6. formula_payment_records
-- 의도적으로 INSERT하지 않음 (외상거래 검증의 핵심 — record 0건)
-- =============================================================================

-- (의도적 공백: payment_records는 이 formula에 대해 한 건도 존재하지 않는다)

-- =============================================================================
-- 7. formula_shares — GioWorks 마진 중 셰어 배분 (예상비용/예상셰어 반영용)
-- =============================================================================

INSERT INTO formula_shares (
    id, formula_id, participant_id, target_company_id,
    share_basis, share_method, share_rate, share_amount, memo
) VALUES (
    '90030000-0000-0000-0006-000000000001',
    '90030000-0000-0000-0003-000000000001',
    '90030000-0000-0000-0004-000000000002',
    '90030000-0000-0000-0001-000000000003',
    'PROFIT', 'FIXED_AMOUNT', NULL, 50000,
    'GioWorks Credit 마진 중 Buyer Credit Co 인센티브 고정 배분'
);

-- =============================================================================
-- 8. formula_versions + formula_calculation_snapshots
-- 예상순이익(GioWorks 관점) = 3,250,000 - 2,000,000 - 100,000 - 50,000 = 1,100,000
-- =============================================================================

INSERT INTO formula_versions (
    id, formula_id, version_no, changed_by, change_reason, snapshot
) VALUES (
    '90030000-0000-0000-0007-000000000001',
    '90030000-0000-0000-0003-000000000001',
    1, 'system_seed', 'TEST-003 초기 등록',
    '{"schema_version": "v1.6.1", "event": "initial_seed", "quantity": 5000}'::jsonb
);

INSERT INTO formula_calculation_snapshots (
    id, formula_id, formula_version_id,
    quantity, total_buy_amount, total_sell_amount,
    total_cost, total_share, net_profit, profit_rate,
    snapshot_data
) VALUES (
    '90030000-0000-0000-0008-000000000001',
    '90030000-0000-0000-0003-000000000001',
    '90030000-0000-0000-0007-000000000001',
    5000, 2000000, 3250000,
    100000, 50000, 1100000, 33.8462,
    '{"basis": "GioWorks 관점", "formula": "total_sell - total_buy - total_cost - total_share"}'::jsonb
);

COMMIT;
