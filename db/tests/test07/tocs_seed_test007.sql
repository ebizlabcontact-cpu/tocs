-- =============================================================================
-- TOCS TEST-007 Seed Data — Share Engine 검증
-- =============================================================================
-- 거래 흐름: Supplier Share Co → GioWorks Share → Buyer Share Co
--           (+ Share Partner A 정액, Share Partner B 정률 셰어 수취)
-- 품목: Share Test Raw Material, 수량 1,000 kg
-- 단가: Supplier(매출1,000) / GioWorks(매입1,000,매출2,000) / Buyer(매입2,000)
--
-- [구조적 사실 보고 - 결함 아님, 기존 설계의 직접적 결과]
-- v_formula_profit_engine.expected_share는 formula_shares 테이블을 직접 SUM하지 않는다.
-- 실제로는 formula_calculation_snapshots.total_share 컬럼에서 가져온다
-- (CTE: expected_base ... SELECT ... total_share FROM formula_calculation_snapshots).
-- 즉 View 레벨에서는 snapshot이 expected_share의 직접 출처이고,
-- formula_shares는 "그 snapshot이 어떤 개별 항목들로 구성되었는지"의 상세 근거(Source of Truth)다.
-- 이 둘이 일치해야 비로소 "formula_shares가 Source of Truth"라는 명제가 검증된다.
-- 이 Seed는 formula_shares에 2개 행(정액 200,000 + 정률 100,000)을 넣고,
-- snapshot.total_share에도 그 합산값(300,000)을 동일하게 넣어 두 값의 합산 일치를
-- Verify SQL에서 별도로 직접 대조하도록 구성했다. (formula_participants.share_amount는
-- v1.2에서 이미 제거되어 존재하지 않으므로 셰어가 그쪽에 저장될 가능성은 원천적으로 없다.)
--
-- 전제: base + supplement + amount_verified fix + TEST-001~006 적용 완료 상태.
-- UUID는 '90070000-...' 패턴으로 기존 119개 UUID와 충돌 없음.
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. companies (5개: Supplier, GioWorks, Buyer, Share Partner A, Share Partner B)
-- =============================================================================

INSERT INTO companies (id, company_name, business_reg_no, representative_name, main_phone, hq_address, is_active) VALUES
('90070000-0000-0000-0001-000000000001', 'Supplier Share Co',  '915-81-00023', '정셰어1', '02-1001-0023', '서울시 금천구 가산로 1', TRUE),
('90070000-0000-0000-0001-000000000002', 'GioWorks Share',     '916-81-00024', '김지오7', '02-1002-0024', '서울시 강남구 봉은사로 2', TRUE),
('90070000-0000-0000-0001-000000000003', 'Buyer Share Co',     '917-81-00025', '이셰어2', '031-900-0025', '경기도 안양시 동안구 3', TRUE),
('90070000-0000-0000-0001-000000000004', 'Share Partner A',    '918-81-00026', '박파트너', '02-1003-0026', '서울시 서초구 반포대로 4', TRUE),
('90070000-0000-0000-0001-000000000005', 'Share Partner B',    '919-81-00027', '최파트너', '02-1004-0027', '서울시 송파구 백제고분로 5', TRUE);

-- =============================================================================
-- 2. items
-- =============================================================================

INSERT INTO items (id, item_code, item_name, default_unit, category, is_active) VALUES
('90070000-0000-0000-0002-000000000001', 'ITEM-SHARE-007', 'Share Test Raw Material', 'kg', '재활용원료', TRUE);

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
    '90070000-0000-0000-0003-000000000001',
    'DOMESTIC',
    '90070000-0000-0000-0002-000000000001',
    'kg',
    1000,
    'KRW',
    'TEST-007: Supplier Share Co -> GioWorks Share -> Buyer Share Co Share Engine 검증',
    '정액 셰어(Share Partner A 200,000) + 정률 셰어(Share Partner B, gross profit의 10%=100,000) 검증.
모든 셰어가 실제 출금 record로 지급되어 확정순이익=예상순이익=700,000이 되는 케이스.',
    'IN_PROGRESS',
    'IN_PROGRESS',
    'COMPLETED',  -- cash_in_status: 입금 전액 완료
    'COMPLETED',  -- cash_out_status: 출금(매입대금+셰어2건) 전액 완료
    'NOT_ISSUED',
    'DRAFT',
    FALSE,
    'system_seed'
);

-- =============================================================================
-- 4. formula_participants
-- 주의: share_amount 컬럼은 v1.2에서 제거되어 존재하지 않음.
--       셰어 관련 컬럼이 이 테이블에 전혀 없다는 것 자체가 "Source of Truth = formula_shares"
--       원칙의 스키마 레벨 강제다.
-- =============================================================================

INSERT INTO formula_participants (
    id, formula_id, company_id, sequence_order,
    role_group, nature_group, payment_group,
    buy_unit_price, sell_unit_price, quantity,
    direct_cost_amount,
    is_start_point, is_end_point
) VALUES
('90070000-0000-0000-0004-000000000001',
 '90070000-0000-0000-0003-000000000001',
 '90070000-0000-0000-0001-000000000001',
 1, 'SUPPLIER', 'MANUFACTURER', 'PREPAYMENT',
 0, 1000, 1000, 0, TRUE, FALSE),

('90070000-0000-0000-0004-000000000002',
 '90070000-0000-0000-0003-000000000001',
 '90070000-0000-0000-0001-000000000002',
 2, 'BUYER', 'DISTRIBUTOR', 'CREDIT',
 1000, 2000, 1000, 0, FALSE, FALSE),

('90070000-0000-0000-0004-000000000003',
 '90070000-0000-0000-0003-000000000001',
 '90070000-0000-0000-0001-000000000003',
 3, 'BUYER', 'DISTRIBUTOR', 'CREDIT',
 2000, 0, 1000, 0, FALSE, TRUE);

-- =============================================================================
-- 5. formula_shares — Share Engine의 Source of Truth
-- Share Partner A: 정액(FIXED_AMOUNT) 200,000
-- Share Partner B: 정률(RATE) gross profit(1,000,000)의 10% = 100,000
-- =============================================================================

INSERT INTO formula_shares (
    id, formula_id, participant_id, target_company_id,
    share_basis, share_method, share_rate, share_amount, memo
) VALUES
-- Share Partner A: 정액
('90070000-0000-0000-0005-000000000001',
 '90070000-0000-0000-0003-000000000001',
 '90070000-0000-0000-0004-000000000002',
 '90070000-0000-0000-0001-000000000004',
 'DIRECT', 'FIXED_AMOUNT', NULL, 200000,
 'Share Partner A 정액 배분 200,000'),

-- Share Partner B: 정률 (gross profit 1,000,000의 10%)
('90070000-0000-0000-0005-000000000002',
 '90070000-0000-0000-0003-000000000001',
 '90070000-0000-0000-0004-000000000002',
 '90070000-0000-0000-0001-000000000005',
 'PROFIT', 'RATE', 10.0000, 100000,
 'Share Partner B 정률 배분 10% of gross profit 1,000,000');

-- =============================================================================
-- 6. formula_payment_schedules
-- IN  : Buyer Share Co -> GioWorks Share         2,000,000 (CREDIT)
-- OUT1: GioWorks Share -> Supplier Share Co      1,000,000 (PREPAYMENT, 매입대금)
-- OUT2: GioWorks Share -> Share Partner A          200,000 (POST_SETTLEMENT, 정액셰어)
-- OUT3: GioWorks Share -> Share Partner B          100,000 (POST_SETTLEMENT, 정률셰어)
-- =============================================================================

INSERT INTO formula_payment_schedules (
    id, formula_id, participant_id, direction, payment_type,
    counterparty_company_id, scheduled_amount, scheduled_date, status
) VALUES
('90070000-0000-0000-0006-000000000001',
 '90070000-0000-0000-0003-000000000001',
 '90070000-0000-0000-0004-000000000002',
 'IN', 'CREDIT',
 '90070000-0000-0000-0001-000000000003',
 2000000, '2026-09-25', 'COMPLETED'),

('90070000-0000-0000-0006-000000000002',
 '90070000-0000-0000-0003-000000000001',
 '90070000-0000-0000-0004-000000000002',
 'OUT', 'PREPAYMENT',
 '90070000-0000-0000-0001-000000000001',
 1000000, '2026-09-22', 'COMPLETED'),

('90070000-0000-0000-0006-000000000003',
 '90070000-0000-0000-0003-000000000001',
 '90070000-0000-0000-0004-000000000002',
 'OUT', 'POST_SETTLEMENT',
 '90070000-0000-0000-0001-000000000004',
 200000, '2026-09-26', 'COMPLETED'),

('90070000-0000-0000-0006-000000000004',
 '90070000-0000-0000-0003-000000000001',
 '90070000-0000-0000-0004-000000000002',
 'OUT', 'POST_SETTLEMENT',
 '90070000-0000-0000-0001-000000000005',
 100000, '2026-09-26', 'COMPLETED');

-- =============================================================================
-- 7. formula_payment_records
-- 각 schedule마다 1건씩 전액 완료 (트리거: record.direction = schedule.direction 일치 필요)
-- =============================================================================

-- [수정] 컬럼 목록에 memo를 추가하여 4개 행 모두 16개 값으로 통일했다.
-- (기존에는 1,2번 행이 15개 값, 3,4번 행이 memo 포함 16개 값으로 길이가 달라
--  "VALUES lists must all be the same length" 오류가 발생했다. 설계 변경 없음,
--  문법 오류만 수정. memo가 없는 행은 NULL을 명시적으로 채운다.)
INSERT INTO formula_payment_records (
    id, formula_id, payment_schedule_id, participant_id, direction,
    counterparty_company_id, actual_amount, actual_date,
    bank_name, account_name, account_no,
    confirmed_by, confirmed_at, status, is_canceled, memo
) VALUES
-- IN: Buyer로부터 2,000,000 입금 완료
('90070000-0000-0000-0007-000000000001',
 '90070000-0000-0000-0003-000000000001',
 '90070000-0000-0000-0006-000000000001',
 '90070000-0000-0000-0004-000000000002',
 'IN',
 '90070000-0000-0000-0001-000000000003',
 2000000, '2026-09-25',
 '우리은행', 'GioWorks Share', '101112-13-141516',
 '한실무', '2026-09-25 10:00:00+09', 'COMPLETED', FALSE, NULL),

-- OUT1: Supplier에게 매입대금 1,000,000 지급 완료
('90070000-0000-0000-0007-000000000002',
 '90070000-0000-0000-0003-000000000001',
 '90070000-0000-0000-0006-000000000002',
 '90070000-0000-0000-0004-000000000002',
 'OUT',
 '90070000-0000-0000-0001-000000000001',
 1000000, '2026-09-22',
 '국민은행', 'Supplier Share Co', '202122-23-242526',
 '한실무', '2026-09-22 09:00:00+09', 'COMPLETED', FALSE, NULL),

-- OUT2: Share Partner A에게 정액 셰어 200,000 지급 완료
('90070000-0000-0000-0007-000000000003',
 '90070000-0000-0000-0003-000000000001',
 '90070000-0000-0000-0006-000000000003',
 '90070000-0000-0000-0004-000000000002',
 'OUT',
 '90070000-0000-0000-0001-000000000004',
 200000, '2026-09-26',
 '신한은행', 'Share Partner A', '303132-33-343536',
 '한실무', '2026-09-26 11:00:00+09', 'COMPLETED', FALSE,
 '정액 셰어 지급 - 확정순이익(실출금) 반영 검증용'),

-- OUT3: Share Partner B에게 정률 셰어 100,000 지급 완료
('90070000-0000-0000-0007-000000000004',
 '90070000-0000-0000-0003-000000000001',
 '90070000-0000-0000-0006-000000000004',
 '90070000-0000-0000-0004-000000000002',
 'OUT',
 '90070000-0000-0000-0001-000000000005',
 100000, '2026-09-26',
 '신한은행', 'Share Partner B', '404142-43-444546',
 '한실무', '2026-09-26 11:30:00+09', 'COMPLETED', FALSE,
 '정률 셰어 지급 - 확정순이익(실출금) 반영 검증용');

-- =============================================================================
-- 8. formula_versions + formula_calculation_snapshots
-- snapshot.total_share는 formula_shares 2건의 합산(200,000+100,000=300,000)과
-- 반드시 동일해야 한다. (Verify SQL 6번에서 이 일치 여부를 직접 SUM으로 재계산하여 대조)
-- 예상순이익(GioWorks 관점) = 2,000,000 - 1,000,000 - 0 - 300,000 = 700,000
-- =============================================================================

INSERT INTO formula_versions (
    id, formula_id, version_no, changed_by, change_reason, snapshot
) VALUES (
    '90070000-0000-0000-0008-000000000001',
    '90070000-0000-0000-0003-000000000001',
    1, 'system_seed', 'TEST-007 초기 등록',
    '{"schema_version": "v1.6.1", "event": "initial_seed", "quantity": 1000}'::jsonb
);

INSERT INTO formula_calculation_snapshots (
    id, formula_id, formula_version_id,
    quantity, total_buy_amount, total_sell_amount,
    total_cost, total_share, net_profit, profit_rate,
    snapshot_data
) VALUES (
    '90070000-0000-0000-0009-000000000001',
    '90070000-0000-0000-0003-000000000001',
    '90070000-0000-0000-0008-000000000001',
    1000, 1000000, 2000000,
    0, 300000, 700000, 35.0000,
    '{"basis": "GioWorks 관점", "formula": "total_sell - total_buy - total_cost(0) - total_share(300000)",
      "share_breakdown": {"Share Partner A": 200000, "Share Partner B": 100000}}'::jsonb
);

COMMIT;
