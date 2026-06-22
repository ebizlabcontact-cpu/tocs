-- =============================================================================
-- TOCS TEST-008 Seed Data — 부분 계산서/부분 입금/부분 출금 검증
-- =============================================================================
-- formula_no: 자동 채번(DEFAULT generate_formula_no())을 사용한다.
-- (참고용 기대값: 사용자가 시나리오 제목에서 언급한 'FM-2606-00011'은 TEST-001~007의
--  자동채번 누적 횟수에 따라 실제로 그 번호가 나올 수도, 다른 번호가 나올 수도 있다.
--  이 번호는 테스트 통과 조건이 아니며, Verify SQL은 prefix 형식과 UNIQUE 저장 여부만 검증한다.)
-- 거래: Supplier Partial Co -> GioWorks Partial -> Buyer Partial Co
-- 거래 유형: DOMESTIC
--
-- [사전 점검 보고 - SQL 작성 전 완료]
--
-- 1. 숫자 독립 재계산: expected_net_profit=1,000,000, receivable=1,000,000,
--    receive_rate=50.00, payable=500,000, payment_rate=50.00,
--    confirmed_net_profit=500,000. 전부 요청서 제시값과 일치 (Python 재계산 완료).
--
-- 2. ENUM 실제 정의 확인: payment_status(PENDING/PARTIAL/COMPLETED/CANCELED),
--    invoice_status(NOT_ISSUED/ISSUED/RECEIVED/AMOUNT_MATCHED/AMOUNT_MISMATCHED/
--    CANCELED/REVISION_REQUIRED) 모두 요청서가 쓰려는 값(PARTIAL, ISSUED,
--    AMOUNT_MATCHED)을 실제로 포함함. ENUM 대체가 필요한 항목 없음.
--
-- 3-4. UUID/business_reg_no 충돌: 기존 TEST-001~007의 141개 UUID, 27개
--    business_reg_no 전체와 대조하여 충돌 없음 확인. UUID는 '90080000-...'
--    패턴, business_reg_no는 920번대부터 사용.
--
-- 5. Trigger 영향 분석:
--    - trg_check_record_direction: IN record는 IN schedule#1에만, OUT record는
--      OUT schedule#1에만 연결. schedule#2(PENDING, record 없음)는 트리거
--      대상이 아님 (record가 없으므로 트리거 자체가 발동하지 않음).
--    - trg_check_invoice_participant_company: 계산서 2건 모두 issuer/receiver
--      participant가 명시된 company와 정확히 일치하도록 설계.
--    - trg_sync_invoice_amount_verified: Invoice#1은 external=total 일치
--      ->amount_verified=TRUE. Invoice#2는 external을 의도적으로 비워
--      ->amount_verified=FALSE (ELSE 분기).
--
-- 6. CHECK Constraint 영향 분석: is_closed=FALSE이므로
--    chk_closed_requires_all_completed는 OR 좌측으로 항상 통과 (6개 상태 무관).
--    금액 전부 양수, issuer!=receiver 등 나머지 CHECK도 전부 통과 확인.
--
-- [구조적 사실 보고 - formula_no 자동 채번으로 통일]
-- formula_no는 DEFAULT generate_formula_no()로 Sequence(formula_seq) 기반 자동 채번된다.
-- 최초 작성 시 사용자가 시나리오 제목에 명시한 'FM-2606-00011'을 INSERT에서 직접
-- 지정했었으나, 이는 향후 충돌 위험이 있는 설계였다:
--   - 직접 지정 시 formula_seq.NEXTVAL이 호출되지 않아 Sequence가 그만큼 덜 증가함.
--   - 이후 TEST-009 이상에서 자동채번이 계속되다가 우연히 NEXTVAL=11에 도달하면
--     'FM-2606-00011'을 다시 생성하게 되고, 이미 TEST-008이 그 번호를 직접 점유한
--     상태이므로 UNIQUE(formula_no) 위반이 발생한다.
-- 이 위험을 사용자가 직접 지적하여, TEST-001~007과 동일하게 자동 채번 방식으로
-- 통일했다. 'FM-2606-00011'은 더 이상 강제되는 값이 아니라 참고용 기대 문자열일
-- 뿐이며, Verify SQL은 prefix('FM-2606-') 형식과 UNIQUE 정상 저장 여부만 검증한다.
--
-- [핵심 설계 사실 - 결함 아님, 이번 테스트가 검증하려는 바로 그 정책]
-- formulas.invoice_status를 자동 갱신하는 트리거는 존재하지 않는다.
-- v_formula_invoice_status가 derived_invoice_status를 계산할 뿐이며,
-- formulas.invoice_status 컬럼 값은 API 레이어(또는 이 Seed)가 직접 결정한다.
-- 이번 Seed는 derived_invoice_status 계산 결과(ISSUED)와 formulas.invoice_status
-- 직접 지정값(ISSUED)을 의도적으로 동일하게 맞춰서, 두 값이 실제로 일치하는지를
-- Verify SQL에서 별도로 대조한다.
--
-- 전제: base + supplement + amount_verified fix + TEST-001~007 적용 완료 상태.
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. companies
-- =============================================================================

INSERT INTO companies (id, company_name, business_reg_no, representative_name, main_phone, hq_address, is_active) VALUES
('90080000-0000-0000-0001-000000000001', 'Supplier Partial Co', '920-81-00028', '정부분1', '02-1101-0028', '서울시 동작구 보라매로 1', TRUE),
('90080000-0000-0000-0001-000000000002', 'GioWorks Partial',    '921-81-00029', '김지오8', '02-1102-0029', '서울시 강남구 언주로 2', TRUE),
('90080000-0000-0000-0001-000000000003', 'Buyer Partial Co',    '922-81-00030', '이부분2', '031-1000-0030', '경기도 부천시 원미구 3', TRUE);

-- =============================================================================
-- 2. items
-- =============================================================================

INSERT INTO items (id, item_code, item_name, default_unit, category, is_active) VALUES
('90080000-0000-0000-0002-000000000001', 'ITEM-PARTIAL-008', 'Partial Test Raw Material', 'kg', '재활용원료', TRUE);

-- =============================================================================
-- 3. formulas
-- formula_no는 자동 채번(DEFAULT generate_formula_no())을 사용한다. cash_in/cash_out=PARTIAL,
-- invoice_status=ISSUED(derived 계산 결과와 일치하도록 설계),
-- 나머지 4개 상태는 IN_PROGRESS, is_closed=FALSE.
-- =============================================================================

INSERT INTO formulas (
    id, trade_type, item_id, unit, quantity,
    base_currency,
    content, note,
    trade_status, delivery_status, cash_in_status, cash_out_status,
    invoice_status, logistics_status,
    is_closed, created_by
) VALUES (
    '90080000-0000-0000-0003-000000000001',
    'DOMESTIC',
    '90080000-0000-0000-0002-000000000001',
    'kg',
    1000,
    'KRW',
    'TEST-008: Supplier Partial Co -> GioWorks Partial -> Buyer Partial Co 부분계산서/부분입금/부분출금 검증',
    '입금 2건 중 1건만 완료, 출금 2건 중 1건만 완료, 계산서 1건 MATCHED+1건 ISSUED.
PARTIAL 상태가 schedule 기준이 아니라 실제 record 존재 여부 기준으로 계산되는지 검증.',
    'IN_PROGRESS',
    'IN_PROGRESS',
    'PARTIAL',
    'PARTIAL',
    'ISSUED',
    'IN_PROGRESS',
    FALSE,
    'system_seed'
);

-- =============================================================================
-- 4. formula_participants
-- expected_buy=1,000,000 / expected_revenue=2,000,000을 만족하는 단가/수량 설계.
-- 수량 1,000kg 기준: buy_unit_price=1,000, sell_unit_price=2,000
-- =============================================================================

INSERT INTO formula_participants (
    id, formula_id, company_id, sequence_order,
    role_group, nature_group, payment_group,
    buy_unit_price, sell_unit_price, quantity,
    direct_cost_amount,
    is_start_point, is_end_point
) VALUES
('90080000-0000-0000-0004-000000000001',
 '90080000-0000-0000-0003-000000000001',
 '90080000-0000-0000-0001-000000000001',
 1, 'SUPPLIER', 'MANUFACTURER', 'PREPAYMENT',
 0, 1000, 1000, 0, TRUE, FALSE),

('90080000-0000-0000-0004-000000000002',
 '90080000-0000-0000-0003-000000000001',
 '90080000-0000-0000-0001-000000000002',
 2, 'BUYER', 'DISTRIBUTOR', 'PARTIAL',
 1000, 2000, 1000, 0, FALSE, FALSE),

('90080000-0000-0000-0004-000000000003',
 '90080000-0000-0000-0003-000000000001',
 '90080000-0000-0000-0001-000000000003',
 3, 'BUYER', 'DISTRIBUTOR', 'PARTIAL',
 2000, 0, 1000, 0, FALSE, TRUE);

-- =============================================================================
-- 5. formula_payment_schedules
-- IN  #1: Buyer -> GioWorks  1,000,000 COMPLETED (record 존재)
-- IN  #2: Buyer -> GioWorks  1,000,000 PENDING   (record 없음)
-- OUT #1: GioWorks -> Supplier 500,000 COMPLETED (record 존재)
-- OUT #2: GioWorks -> Supplier 500,000 PENDING   (record 없음)
-- =============================================================================

INSERT INTO formula_payment_schedules (
    id, formula_id, participant_id, direction, payment_type,
    counterparty_company_id, scheduled_amount, scheduled_date, status
) VALUES
('90080000-0000-0000-0005-000000000001',
 '90080000-0000-0000-0003-000000000001',
 '90080000-0000-0000-0004-000000000002',
 'IN', 'INSTALLMENT',
 '90080000-0000-0000-0001-000000000003',
 1000000, '2026-09-30', 'COMPLETED'),

('90080000-0000-0000-0005-000000000002',
 '90080000-0000-0000-0003-000000000001',
 '90080000-0000-0000-0004-000000000002',
 'IN', 'INSTALLMENT',
 '90080000-0000-0000-0001-000000000003',
 1000000, '2026-10-15', 'PENDING'),

('90080000-0000-0000-0005-000000000003',
 '90080000-0000-0000-0003-000000000001',
 '90080000-0000-0000-0004-000000000002',
 'OUT', 'INSTALLMENT',
 '90080000-0000-0000-0001-000000000001',
 500000, '2026-09-28', 'COMPLETED'),

('90080000-0000-0000-0005-000000000004',
 '90080000-0000-0000-0003-000000000001',
 '90080000-0000-0000-0004-000000000002',
 'OUT', 'INSTALLMENT',
 '90080000-0000-0000-0001-000000000001',
 500000, '2026-10-10', 'PENDING');

-- =============================================================================
-- 6. formula_payment_records
-- schedule#1(IN), schedule#3(OUT)에만 record 존재. schedule#2, #4는 의도적으로
-- record 없음 (PENDING 상태 유지 -> Payment Record 기준 PARTIAL 계산 검증의 핵심).
-- =============================================================================

INSERT INTO formula_payment_records (
    id, formula_id, payment_schedule_id, participant_id, direction,
    counterparty_company_id, actual_amount, actual_date,
    bank_name, account_name, account_no,
    confirmed_by, confirmed_at, status, is_canceled
) VALUES (
    '90080000-0000-0000-0006-000000000001',
    '90080000-0000-0000-0003-000000000001',
    '90080000-0000-0000-0005-000000000001',
    '90080000-0000-0000-0004-000000000002',
    'IN',
    '90080000-0000-0000-0001-000000000003',
    1000000, '2026-09-30',
    '카카오뱅크', 'GioWorks Partial', '111213-14-151617',
    '윤부분', '2026-09-30 10:00:00+09', 'COMPLETED', FALSE
);

INSERT INTO formula_payment_records (
    id, formula_id, payment_schedule_id, participant_id, direction,
    counterparty_company_id, actual_amount, actual_date,
    bank_name, account_name, account_no,
    confirmed_by, confirmed_at, status, is_canceled
) VALUES (
    '90080000-0000-0000-0006-000000000002',
    '90080000-0000-0000-0003-000000000001',
    '90080000-0000-0000-0005-000000000003',
    '90080000-0000-0000-0004-000000000002',
    'OUT',
    '90080000-0000-0000-0001-000000000001',
    500000, '2026-09-28',
    '토스뱅크', 'Supplier Partial Co', '212223-24-252627',
    '윤부분', '2026-09-28 09:00:00+09', 'COMPLETED', FALSE
);

-- =============================================================================
-- 7. formula_invoices
-- Invoice #1: AMOUNT_MATCHED, amount_verified=TRUE가 자동 산출되도록
--             external_invoice_amount = supply+tax 정확히 일치시킴.
-- Invoice #2: ISSUED, amount_verified=FALSE가 자동 산출되도록
--             external_invoice_amount를 NULL로 비움 (트리거 ELSE 분기).
-- =============================================================================

INSERT INTO formula_invoices (
    id, formula_id, issuer_company_id, receiver_company_id,
    issuer_participant_id, receiver_participant_id, sequence_order,
    invoice_no, invoice_date,
    external_invoice_amount, supply_amount, tax_amount,
    status, memo
) VALUES (
    '90080000-0000-0000-0007-000000000001',
    '90080000-0000-0000-0003-000000000001',
    '90080000-0000-0000-0001-000000000001',
    '90080000-0000-0000-0001-000000000002',
    '90080000-0000-0000-0004-000000000001',
    '90080000-0000-0000-0004-000000000002',
    1,
    'INV-PARTIAL-2026-0001', '2026-09-28',
    1000000, 1000000, 0,
    'AMOUNT_MATCHED',
    '매입 계산서 - 금액 일치, amount_verified=TRUE 기대'
);

INSERT INTO formula_invoices (
    id, formula_id, issuer_company_id, receiver_company_id,
    issuer_participant_id, receiver_participant_id, sequence_order,
    invoice_no, invoice_date,
    supply_amount, tax_amount,
    status, memo
) VALUES (
    '90080000-0000-0000-0007-000000000002',
    '90080000-0000-0000-0003-000000000001',
    '90080000-0000-0000-0001-000000000002',
    '90080000-0000-0000-0001-000000000003',
    '90080000-0000-0000-0004-000000000002',
    '90080000-0000-0000-0004-000000000003',
    2,
    'INV-PARTIAL-2026-0002', '2026-09-30',
    2000000, 0,
    'ISSUED',
    '매출 계산서 - 발행만 되고 외부 원본금액 미확인 상태, amount_verified=FALSE 기대'
);

-- =============================================================================
-- 8. formula_versions + formula_calculation_snapshots
-- 예상순이익(GioWorks 관점) = 2,000,000 - 1,000,000 - 0 - 0 = 1,000,000
-- =============================================================================

INSERT INTO formula_versions (
    id, formula_id, version_no, changed_by, change_reason, snapshot
) VALUES (
    '90080000-0000-0000-0008-000000000001',
    '90080000-0000-0000-0003-000000000001',
    1, 'system_seed', 'TEST-008 초기 등록',
    '{"schema_version": "v1.6.1", "event": "initial_seed", "quantity": 1000}'::jsonb
);

INSERT INTO formula_calculation_snapshots (
    id, formula_id, formula_version_id,
    quantity, total_buy_amount, total_sell_amount,
    total_cost, total_share, net_profit, profit_rate,
    snapshot_data
) VALUES (
    '90080000-0000-0000-0009-000000000001',
    '90080000-0000-0000-0003-000000000001',
    '90080000-0000-0000-0008-000000000001',
    1000, 1000000, 2000000,
    0, 0, 1000000, 50.0000,
    '{"basis": "GioWorks 관점", "formula": "total_sell - total_buy - total_cost(0) - total_share(0)"}'::jsonb
);

COMMIT;
