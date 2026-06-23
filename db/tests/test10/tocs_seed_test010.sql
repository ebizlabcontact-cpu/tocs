-- =============================================================================
-- TOCS TEST-010 Seed Data — Formula Cancel Flow 검증
-- =============================================================================
-- 정책 확정 (요청서 기준):
--   1. 취소는 종결이 아니다. is_closed=TRUE는 정상 완료 종결만 의미한다.
--   2. Formula 전체 취소는 6개 상태 전부 CANCELED로 처리한다.
--   3. 취소 Formula도 실제 입출금 record가 있으면 DB KPI View에는 그대로
--      반영한다. View는 실제 돈 흐름 기준이며, 취소 거래 제외는 API/UI 책임.
--   4. 종결된 Formula(is_closed=TRUE)는 취소 불가 (CHECK Constraint로 차단).
--
-- 거래: Supplier Cancel Co -> GioWorks Cancel -> Buyer Cancel Co
--
-- [트랜잭션 분리 설계 - 우회 아님]
-- 이 파일은 두 개의 독립된 트랜잭션으로 구성된다.
--   트랜잭션 1 (메인, COMMIT): 취소 대상 Formula 생성 + 입금 record 1건 +
--     6개 상태 전부 CANCELED로 UPDATE + status_logs/audit_logs 기록.
--   트랜잭션 2 (음성 테스트, 의도적 ROLLBACK): is_closed=TRUE로 정상 종결된
--     별도 Formula를 만든 뒤, 그 상태에서 trade_status를 CANCELED로 바꾸는
--     UPDATE를 시도한다. chk_closed_requires_all_completed CHECK 위반으로
--     이 UPDATE는 반드시 실패해야 한다.
-- 단일 BEGIN~COMMIT 안에 정상 데이터와 의도된 실패를 함께 두면, PostgreSQL은
-- CHECK 위반 발생 즉시 트랜잭션 전체를 abort 상태로 만들어 그 이전의 정상
-- INSERT까지 전부 롤백시킨다. 따라서 음성 테스트는 반드시 별도 트랜잭션으로
-- 분리해야 하며, 이 트랜잭션은 검증 목적의 일회성이므로 끝에 ROLLBACK으로
-- 마무리하여 데이터를 남기지 않는다(영구 보존할 이유가 없음).
--
-- 전제: base + supplement + amount_verified fix + TEST-001~009 적용 완료 상태.
-- UUID는 '90100000-...' 패턴으로 기존 176개 UUID와 충돌 없음.
-- =============================================================================

-- =============================================================================
-- 트랜잭션 1 (메인) — 취소 대상 Formula
-- =============================================================================

BEGIN;

-- 1. companies
INSERT INTO companies (id, company_name, business_reg_no, representative_name, main_phone, hq_address, is_active) VALUES
('90100000-0000-0000-0001-000000000001', 'Supplier Cancel Co', '926-81-00034', '정취소1', '02-1301-0034', '서울시 강서구 공항대로 1', TRUE),
('90100000-0000-0000-0001-000000000002', 'GioWorks Cancel',    '927-81-00035', '김지오10', '02-1302-0035', '서울시 강남구 대치동 2', TRUE),
('90100000-0000-0000-0001-000000000003', 'Buyer Cancel Co',    '928-81-00036', '이취소2', '031-1200-0036', '경기도 용인시 기흥구 3', TRUE);

-- 2. items
INSERT INTO items (id, item_code, item_name, default_unit, category, is_active) VALUES
('90100000-0000-0000-0002-000000000001', 'ITEM-CANCEL-010', 'Cancel Test Raw Material', 'kg', '재활용원료', TRUE);

-- 3. formulas — 취소 대상. 최초에는 일반 진행중 상태로 생성.
INSERT INTO formulas (
    id, trade_type, item_id, unit, quantity,
    base_currency,
    content, note,
    trade_status, delivery_status, cash_in_status, cash_out_status,
    invoice_status, logistics_status,
    is_closed, created_by
) VALUES (
    '90100000-0000-0000-0003-000000000001',
    'DOMESTIC',
    '90100000-0000-0000-0002-000000000001',
    'kg',
    1000,
    'KRW',
    'TEST-010: Supplier Cancel Co -> GioWorks Cancel -> Buyer Cancel Co Cancel Flow 검증',
    '입금 1건 존재하는 상태에서 6개 상태 전부 CANCELED로 전환. is_closed=FALSE 유지.
DB View가 취소 여부와 무관하게 실제 입출금 record를 그대로 반영하는지 검증.',
    'IN_PROGRESS',
    'IN_PROGRESS',
    'COMPLETED',  -- 입금 1건이 이미 완료된 상태 (취소 이전 시점)
    'PENDING',
    'NOT_ISSUED',
    'DRAFT',
    FALSE,
    'system_seed'
);

-- 4. formula_participants
INSERT INTO formula_participants (
    id, formula_id, company_id, sequence_order,
    role_group, nature_group, payment_group,
    buy_unit_price, sell_unit_price, quantity,
    direct_cost_amount,
    is_start_point, is_end_point
) VALUES
('90100000-0000-0000-0004-000000000001',
 '90100000-0000-0000-0003-000000000001',
 '90100000-0000-0000-0001-000000000001',
 1, 'SUPPLIER', 'MANUFACTURER', 'PREPAYMENT',
 0, 1000, 1000, 0, TRUE, FALSE),

('90100000-0000-0000-0004-000000000002',
 '90100000-0000-0000-0003-000000000001',
 '90100000-0000-0000-0001-000000000002',
 2, 'BUYER', 'DISTRIBUTOR', 'CREDIT',
 1000, 1500, 1000, 0, FALSE, FALSE),

('90100000-0000-0000-0004-000000000003',
 '90100000-0000-0000-0003-000000000001',
 '90100000-0000-0000-0001-000000000003',
 3, 'BUYER', 'DISTRIBUTOR', 'CREDIT',
 1500, 0, 1000, 0, FALSE, TRUE);

-- 5. formula_payment_schedules — IN 1건
INSERT INTO formula_payment_schedules (
    id, formula_id, participant_id, direction, payment_type,
    counterparty_company_id, scheduled_amount, scheduled_date, status
) VALUES (
    '90100000-0000-0000-0005-000000000001',
    '90100000-0000-0000-0003-000000000001',
    '90100000-0000-0000-0004-000000000002',
    'IN', 'CREDIT',
    '90100000-0000-0000-0001-000000000003',
    1500000, '2026-10-25', 'COMPLETED'
);

-- 6. formula_payment_records — 입금 record 1건 (취소 이전에 이미 실제로 들어온 돈)
-- is_canceled=FALSE 유지. formulas.*_status=CANCELED와는 완전히 별개의 컬럼/메커니즘.
INSERT INTO formula_payment_records (
    id, formula_id, payment_schedule_id, participant_id, direction,
    counterparty_company_id, actual_amount, actual_date,
    bank_name, account_name, account_no,
    confirmed_by, confirmed_at, status, is_canceled
) VALUES (
    '90100000-0000-0000-0006-000000000001',
    '90100000-0000-0000-0003-000000000001',
    '90100000-0000-0000-0005-000000000001',
    '90100000-0000-0000-0004-000000000002',
    'IN',
    '90100000-0000-0000-0001-000000000003',
    1500000, '2026-10-25',
    '카카오뱅크', 'GioWorks Cancel', '131415-16-171819',
    '오취소', '2026-10-25 10:00:00+09', 'COMPLETED', FALSE
);

-- 7. formula_versions + formula_calculation_snapshots (취소 전 예상 KPI 보존용)
INSERT INTO formula_versions (
    id, formula_id, version_no, changed_by, change_reason, snapshot
) VALUES (
    '90100000-0000-0000-0007-000000000001',
    '90100000-0000-0000-0003-000000000001',
    1, 'system_seed', 'TEST-010 초기 등록 (취소 이전 상태)',
    '{"schema_version": "v1.6.1", "event": "initial_seed", "quantity": 1000}'::jsonb
);

INSERT INTO formula_calculation_snapshots (
    id, formula_id, formula_version_id,
    quantity, total_buy_amount, total_sell_amount,
    total_cost, total_share, net_profit, profit_rate,
    snapshot_data
) VALUES (
    '90100000-0000-0000-0008-000000000001',
    '90100000-0000-0000-0003-000000000001',
    '90100000-0000-0000-0007-000000000001',
    1000, 1000000, 1500000,
    0, 0, 500000, 33.3333,
    '{"basis": "GioWorks 관점", "formula": "total_sell - total_buy - total_cost(0) - total_share(0)"}'::jsonb
);

-- =============================================================================
-- 8. Formula 전체 취소 — 6개 상태 전부 CANCELED로 UPDATE
-- is_closed=FALSE 유지 상태이므로 chk_closed_requires_all_completed는
-- "NOT is_closed=TRUE"로 자동 통과 (6개 상태 값과 무관).
-- =============================================================================

UPDATE formulas
SET
    trade_status = 'CANCELED',
    delivery_status = 'CANCELED',
    cash_in_status = 'CANCELED',
    cash_out_status = 'CANCELED',
    invoice_status = 'CANCELED',
    logistics_status = 'CANCELED',
    updated_at = NOW()
WHERE id = '90100000-0000-0000-0003-000000000001';

-- =============================================================================
-- 9. formula_status_logs — 6건 (상태 컬럼당 1건씩)
-- =============================================================================

INSERT INTO formula_status_logs (
    id, formula_id, status_target, prev_status, new_status, changed_by, change_reason
) VALUES
('90100000-0000-0000-0009-000000000001', '90100000-0000-0000-0003-000000000001',
 'TRADE_STATUS', 'IN_PROGRESS', 'CANCELED', 'system_seed', 'TEST-010 Formula 전체 취소'),
('90100000-0000-0000-0009-000000000002', '90100000-0000-0000-0003-000000000001',
 'DELIVERY_STATUS', 'IN_PROGRESS', 'CANCELED', 'system_seed', 'TEST-010 Formula 전체 취소'),
('90100000-0000-0000-0009-000000000003', '90100000-0000-0000-0003-000000000001',
 'CASH_IN_STATUS', 'COMPLETED', 'CANCELED', 'system_seed', 'TEST-010 Formula 전체 취소'),
('90100000-0000-0000-0009-000000000004', '90100000-0000-0000-0003-000000000001',
 'CASH_OUT_STATUS', 'PENDING', 'CANCELED', 'system_seed', 'TEST-010 Formula 전체 취소'),
('90100000-0000-0000-0009-000000000005', '90100000-0000-0000-0003-000000000001',
 'INVOICE_STATUS', 'NOT_ISSUED', 'CANCELED', 'system_seed', 'TEST-010 Formula 전체 취소'),
('90100000-0000-0000-0009-000000000006', '90100000-0000-0000-0003-000000000001',
 'LOGISTICS_STATUS', 'DRAFT', 'CANCELED', 'system_seed', 'TEST-010 Formula 전체 취소');

-- =============================================================================
-- 10. audit_logs — 1건
-- =============================================================================

INSERT INTO audit_logs (
    id, table_name, record_id, action, changed_by, old_data, new_data
) VALUES (
    '90100000-0000-0000-0010-000000000001',
    'formulas',
    '90100000-0000-0000-0003-000000000001',
    'CANCEL',
    'system_seed',
    '{"trade_status": "IN_PROGRESS", "delivery_status": "IN_PROGRESS",
      "cash_in_status": "COMPLETED", "cash_out_status": "PENDING",
      "invoice_status": "NOT_ISSUED", "logistics_status": "DRAFT"}'::jsonb,
    '{"trade_status": "CANCELED", "delivery_status": "CANCELED",
      "cash_in_status": "CANCELED", "cash_out_status": "CANCELED",
      "invoice_status": "CANCELED", "logistics_status": "CANCELED",
      "cancel_reason": "TEST-010 Formula 전체 취소 시나리오"}'::jsonb
);

COMMIT;

-- =============================================================================
-- 트랜잭션 2 (음성 테스트, 의도적 ROLLBACK)
-- 종결된(is_closed=TRUE) Formula에 대한 취소 시도가 CHECK Constraint 위반으로
-- 실제로 실패하는지 검증한다. 이 트랜잭션은 끝에 ROLLBACK으로 마무리되어
-- 데이터를 영구적으로 남기지 않는다.
--
-- *** 실행자 필독 ***
-- 아래 트랜잭션 실행 시 psql 화면에 다음과 같은 ERROR가 출력되는 것이 정상이며,
-- 이것이 바로 "음성 테스트 PASS"를 의미한다. Seed 실행 실패가 아니다.
--
--   ERROR:  new row for relation "formulas" violates check constraint
--           "chk_closed_requires_all_completed"
--
-- 만약 이 ERROR가 출력되지 않고 UPDATE가 조용히 성공한다면, 그것이 오히려
-- FAIL이다 (CHECK Constraint가 의도대로 작동하지 않는다는 뜻).
-- 이 트랜잭션 마지막의 ROLLBACK은 트랜잭션이 abort 상태이든 정상 상태이든
-- PostgreSQL이 항상 허용하는 명령이므로 별도 에러 없이 실행되어 트랜잭션을
-- 종료시킨다. (COMMIT을 썼다면 PostgreSQL이 자동으로 ROLLBACK 처리하며
-- 경고를 내므로, 의도를 명확히 하기 위해 ROLLBACK을 명시했다.)
-- =============================================================================

BEGIN;

INSERT INTO companies (id, company_name, business_reg_no, representative_name, main_phone, hq_address, is_active) VALUES
('90100000-0000-0000-0011-000000000001', 'Closed Formula Negative Test Co', '929-81-00037', '정음성', '02-1303-0037', '서울시 종로구 세종대로 4', TRUE);

INSERT INTO items (id, item_code, item_name, default_unit, category, is_active) VALUES
('90100000-0000-0000-0012-000000000001', 'ITEM-NEGTEST-010', 'Negative Test Material', 'kg', '재활용원료', TRUE);

-- 6개 상태 전부 COMPLETED/AMOUNT_MATCHED + is_closed=TRUE로 정상 종결 Formula 생성
-- (TEST-006과 동일 패턴: chk_closed_requires_all_completed, chk_closed_at_consistency 통과)
INSERT INTO formulas (
    id, trade_type, item_id, unit, quantity,
    base_currency,
    content, note,
    trade_status, delivery_status, cash_in_status, cash_out_status,
    invoice_status, logistics_status,
    is_closed, closed_at, created_by
) VALUES (
    '90100000-0000-0000-0013-000000000001',
    'DOMESTIC',
    '90100000-0000-0000-0012-000000000001',
    'kg',
    100,
    'KRW',
    'TEST-010 음성 테스트용 — 정상 종결된 Formula에 대한 취소 시도 검증',
    '이 Formula는 is_closed=TRUE 정상 종결 상태이며, 이후 trade_status를 CANCELED로
바꾸려는 UPDATE가 chk_closed_requires_all_completed 위반으로 실패해야 한다.',
    'COMPLETED', 'COMPLETED', 'COMPLETED', 'COMPLETED', 'AMOUNT_MATCHED', 'COMPLETED',
    TRUE, NOW(),
    'system_seed'
);

-- [의도된 실패 지점] 이 UPDATE는 chk_closed_requires_all_completed 위반으로
-- 반드시 실패해야 한다. is_closed=TRUE인데 trade_status가 COMPLETED가 아니게
-- 되므로 "NOT is_closed OR (6개 상태 = COMPLETED/AMOUNT_MATCHED)" 조건의
-- 양쪽이 모두 FALSE가 된다.
UPDATE formulas
SET trade_status = 'CANCELED'
WHERE id = '90100000-0000-0000-0013-000000000001';

-- 위 UPDATE가 실패하면 트랜잭션은 이미 abort 상태이므로 이 ROLLBACK은
-- 형식상의 마무리다. 만약 위 UPDATE가 예상과 달리 성공해 버린다면(즉 CHECK가
-- 작동하지 않는 경우), 이 ROLLBACK이 정상 실행되어 음성 테스트용 데이터가
-- 폐기된다 — 두 경우 모두 영구 데이터는 남지 않는다.
ROLLBACK;
