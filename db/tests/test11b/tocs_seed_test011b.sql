-- =============================================================================
-- TOCS TEST-011B Seed Data — Concurrency Defense Test (재생성)
-- =============================================================================
-- 배경: TEST-011 1차 실행에서 Transaction 1(메인)이 이미 COMMIT되어
--      V1/V2 Formula 데이터가 DB에 남아 있는 상태에서, Transaction 3(재시도)이
--      audit_logs.action 값 길이 초과(28자 > VARCHAR(20))로 ROLLBACK되었다.
--      동일 Seed를 그대로 재실행하면 Transaction 1의 companies INSERT에서
--      PK 충돌이 먼저 발생하여 음성 테스트(UNIQUE(formula_id, version_no) 위반)
--      대상 자체가 가려진다. 따라서 완전히 새로운 식별자로 TEST-011B를
--      재구성한다. 기존 TEST-011 데이터는 그대로 유지하며 손대지 않는다.
--
-- UUID prefix: '9012b000-...' (기존 TEST-011의 '90110000-...'와 완전히 구분됨,
-- hex 문자 0-9/a-f만 사용하여 유효한 UUID 형식 유지)
-- business_reg_no: 933번대부터 사용 (기존 최댓값 932 이후)
--
-- 트랜잭션 구조 (TEST-011과 동일 원칙):
--   트랜잭션 1 (메인, COMMIT): 기준 Formula + Version 1 + Version 2 정상 생성.
--   트랜잭션 2 (음성 테스트, 의도적 ROLLBACK): 동일 version_no=2로 중복 INSERT
--     시도 -> UNIQUE 위반 -> Snapshot 연쇄 차단 -> ROLLBACK.
--   트랜잭션 3 (재시도 시뮬레이션, COMMIT): MAX(version_no) 재조회 시뮬레이션
--     -> Version 3 정상 생성 + audit_logs(action='VERSION_RETRY', 13자,
--     VARCHAR(20) 이내) 기록.
--
-- *** 실행자 필독 ***
-- 트랜잭션 2 실행 시 다음 ERROR가 출력되는 것이 정상이며, 이것이 곧
-- "동시성 방어선 정상 작동"의 증거다. Seed 실행 실패가 아니다.
--   ERROR:  duplicate key value violates unique constraint
--           "formula_versions_formula_id_version_no_key" (또는 동일 의미의 제약명)
--
-- 전제: base + supplement + amount_verified fix + TEST-001~010
--      + TEST-011(1차 실행, V1/V2까지 COMMIT된 상태) 적용 완료 상태.
-- DB 구조/View/Trigger는 전혀 변경하지 않는다.
-- =============================================================================

-- =============================================================================
-- 트랜잭션 1 (메인) — 기준 Formula + Version 1, 2 정상 생성
-- =============================================================================

BEGIN;

-- 1. companies
INSERT INTO companies (id, company_name, business_reg_no, representative_name, main_phone, hq_address, is_active) VALUES
('9012b000-0000-0000-0001-000000000001', 'Supplier Concurrency Co B', '933-81-00041', '정동시1B', '02-1501-0041', '서울시 마포구 양화로 11', TRUE),
('9012b000-0000-0000-0001-000000000002', 'GioWorks Concurrency B',    '934-81-00042', '김지오11B', '02-1502-0042', '서울시 강남구 압구정로 12', TRUE),
('9012b000-0000-0000-0001-000000000003', 'Buyer Concurrency Co B',    '935-81-00043', '이동시2B', '031-1400-0043', '경기도 수원시 영통구 13', TRUE);

-- 2. items
INSERT INTO items (id, item_code, item_name, default_unit, category, is_active) VALUES
('9012b000-0000-0000-0002-000000000001', 'ITEM-CONCUR-011B', 'Concurrency Test Raw Material B', 'kg', '재활용원료', TRUE);

-- 3. formulas
INSERT INTO formulas (
    id, trade_type, item_id, unit, quantity,
    base_currency,
    content, note,
    trade_status, delivery_status, cash_in_status, cash_out_status,
    invoice_status, logistics_status,
    is_closed, created_by
) VALUES (
    '9012b000-0000-0000-0003-000000000001',
    'DOMESTIC',
    '9012b000-0000-0000-0002-000000000001',
    'kg',
    1000,
    'KRW',
    'TEST-011B: Concurrency Defense Test 재생성 — Version Engine UNIQUE 방어선 검증',
    'TEST-011 1차 실행에서 Transaction 3 실패(action 컬럼 길이 초과) 후
새 식별자로 재구성. Version 1->2 정상 생성 후 동일 version_no=2 중복 INSERT를
시도하여 UNIQUE(formula_id, version_no) 위반과 Snapshot 연쇄 차단을 검증.
이후 재조회 기반 재시도로 Version 3을 정상 생성한다.',
    'IN_PROGRESS',
    'IN_PROGRESS',
    'PENDING',
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
('9012b000-0000-0000-0004-000000000001',
 '9012b000-0000-0000-0003-000000000001',
 '9012b000-0000-0000-0001-000000000001',
 1, 'SUPPLIER', 'MANUFACTURER', 'PREPAYMENT',
 0, 1000, 1000, 0, TRUE, FALSE),

('9012b000-0000-0000-0004-000000000002',
 '9012b000-0000-0000-0003-000000000001',
 '9012b000-0000-0000-0001-000000000002',
 2, 'BUYER', 'DISTRIBUTOR', 'CREDIT',
 1000, 1500, 1000, 0, FALSE, FALSE),

('9012b000-0000-0000-0004-000000000003',
 '9012b000-0000-0000-0003-000000000001',
 '9012b000-0000-0000-0001-000000000003',
 3, 'BUYER', 'DISTRIBUTOR', 'CREDIT',
 1500, 0, 1000, 0, FALSE, TRUE);

-- 5. formula_versions V1 + snapshot V1 (buy=1,000,000, sell=1,500,000, profit=500,000)
INSERT INTO formula_versions (
    id, formula_id, version_no, changed_by, change_reason, snapshot
) VALUES (
    '9012b000-0000-0000-0005-000000000001',
    '9012b000-0000-0000-0003-000000000001',
    1, 'system_seed', 'TEST-011B V1 초기 등록',
    '{"schema_version": "v1.6.1", "event": "initial_seed", "version_no": 1,
      "buy_unit_price": 1000, "total_buy_amount": 1000000}'::jsonb
);

INSERT INTO formula_calculation_snapshots (
    id, formula_id, formula_version_id,
    quantity, total_buy_amount, total_sell_amount,
    total_cost, total_share, net_profit, profit_rate,
    snapshot_data
) VALUES (
    '9012b000-0000-0000-0006-000000000001',
    '9012b000-0000-0000-0003-000000000001',
    '9012b000-0000-0000-0005-000000000001',
    1000, 1000000, 1500000,
    0, 0, 500000, 33.3333,
    '{"version_no": 1}'::jsonb
);

-- 6. formula_versions V2 + snapshot V2 (buy=1,200,000, sell=1,500,000, profit=300,000)
INSERT INTO formula_versions (
    id, formula_id, version_no, changed_by, change_reason, snapshot
) VALUES (
    '9012b000-0000-0000-0005-000000000002',
    '9012b000-0000-0000-0003-000000000001',
    2, 'system_seed', 'TEST-011B V2: 매입단가 변경 1,000 -> 1,200',
    '{"schema_version": "v1.6.1", "event": "version_increment", "version_no": 2,
      "buy_unit_price": 1200, "total_buy_amount": 1200000}'::jsonb
);

INSERT INTO formula_calculation_snapshots (
    id, formula_id, formula_version_id,
    quantity, total_buy_amount, total_sell_amount,
    total_cost, total_share, net_profit, profit_rate,
    snapshot_data
) VALUES (
    '9012b000-0000-0000-0006-000000000002',
    '9012b000-0000-0000-0003-000000000001',
    '9012b000-0000-0000-0005-000000000002',
    1000, 1200000, 1500000,
    0, 0, 300000, 20.0000,
    '{"version_no": 2}'::jsonb
);

COMMIT;

-- =============================================================================
-- 트랜잭션 2 (음성 테스트, 의도적 ROLLBACK)
-- 동일 formula_id + version_no=2로 중복 INSERT를 시도하여 동시성 충돌을
-- 시뮬레이션한다. 이미 V2(version_no=2)가 트랜잭션 1에서 정상 저장된
-- 상태이므로 UNIQUE(formula_id, version_no) 위반이 발생해야 한다.
--
-- *** 실행자 필독 ***
-- 아래 INSERT에서 다음과 같은 ERROR가 출력되는 것이 정상이며, 이것이 바로
-- "동시성 방어선 PASS"의 증거다. Seed 실행 실패가 아니다.
--   ERROR:  duplicate key value violates unique constraint ".../UNIQUE(formula_id, version_no)"
-- =============================================================================

BEGIN;

-- [의도된 실패 지점] 동일 formula_id + version_no=2로 중복 INSERT 시도
INSERT INTO formula_versions (
    id, formula_id, version_no, changed_by, change_reason, snapshot
) VALUES (
    '9012b000-0000-0000-0005-000000000099',
    '9012b000-0000-0000-0003-000000000001',
    2,  -- 이미 트랜잭션 1에서 사용된 version_no
    'system_seed_concurrent_attempt',
    'TEST-011B 동시 요청 시뮬레이션: 충돌하는 version_no=2 중복 시도',
    '{"schema_version": "v1.6.1", "event": "concurrent_collision_attempt", "version_no": 2,
      "buy_unit_price": 1250, "total_buy_amount": 1250000}'::jsonb
);

-- 위 INSERT가 실패하면 트랜잭션은 이미 abort 상태이므로, 아래 snapshot INSERT는
-- 실행되지 못하고 무시된다. 이것이 "Snapshot 연쇄 차단"의 증거다.
INSERT INTO formula_calculation_snapshots (
    id, formula_id, formula_version_id,
    quantity, total_buy_amount, total_sell_amount,
    total_cost, total_share, net_profit, profit_rate,
    snapshot_data
) VALUES (
    '9012b000-0000-0000-0006-000000000099',
    '9012b000-0000-0000-0003-000000000001',
    '9012b000-0000-0000-0005-000000000099',
    1000, 1250000, 1500000,
    0, 0, 250000, 16.6667,
    '{"version_no": 2, "note": "이 INSERT는 실행되지 않아야 한다"}'::jsonb
);

-- ROLLBACK은 트랜잭션 abort 여부와 무관하게 PostgreSQL이 항상 허용하는 명령이다.
ROLLBACK;

-- =============================================================================
-- 트랜잭션 3 (재시도 시뮬레이션, COMMIT)
-- "API가 충돌을 감지한 후 최신 version_no를 재조회하여 재시도한다"는 동작을
-- 시뮬레이션한다. 충돌을 피한 다음 번호(3)로 정상 INSERT를 시도한다.
--
-- [길이 제약 준수] audit_logs.action은 VARCHAR(20)이다. 'VERSION_RETRY'는
-- 13자로 한도 이내이다(TEST-011 1차 실행에서 'VERSION_RETRY_AFTER_CONFLICT'
-- 28자를 사용하여 발생했던 오류를 이번에는 사전에 차단함).
-- =============================================================================

BEGIN;

INSERT INTO formula_versions (
    id, formula_id, version_no, changed_by, change_reason, snapshot
) VALUES (
    '9012b000-0000-0000-0005-000000000003',
    '9012b000-0000-0000-0003-000000000001',
    3,  -- SELECT MAX(version_no)+1 재조회 결과로 결정된 충돌 없는 다음 번호
    'system_seed_retry',
    'TEST-011B V3: 충돌(version_no=2) 감지 후 재조회 기반 재시도로 생성됨',
    '{"schema_version": "v1.6.1", "event": "version_increment_after_retry", "version_no": 3,
      "buy_unit_price": 1300, "total_buy_amount": 1300000,
      "retry_context": "version_no=2 충돌 감지 -> MAX(version_no) 재조회 -> 3으로 재시도"}'::jsonb
);

INSERT INTO formula_calculation_snapshots (
    id, formula_id, formula_version_id,
    quantity, total_buy_amount, total_sell_amount,
    total_cost, total_share, net_profit, profit_rate,
    snapshot_data
) VALUES (
    '9012b000-0000-0000-0006-000000000003',
    '9012b000-0000-0000-0003-000000000001',
    '9012b000-0000-0000-0005-000000000003',
    1000, 1300000, 1500000,
    0, 0, 200000, 13.3333,
    '{"version_no": 3}'::jsonb
);

-- audit_logs — 충돌 발생 및 재시도로 해결된 경위 기록 (action='VERSION_RETRY', 13자)
INSERT INTO audit_logs (
    id, table_name, record_id, action, changed_by, old_data, new_data
) VALUES (
    '9012b000-0000-0000-0007-000000000001',
    'formula_versions',
    '9012b000-0000-0000-0003-000000000001',
    'VERSION_RETRY',
    'system_seed_retry',
    '{"attempted_version_no": 2, "conflict": "unique_violation",
      "sqlstate": "23505"}'::jsonb,
    '{"resolved_version_no": 3, "retry_strategy": "re-fetch MAX(version_no) then increment"}'::jsonb
);

COMMIT;
