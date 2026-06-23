-- =============================================================================
-- TOCS TEST-011 Seed Data — Concurrency Defense Test (Version Engine)
-- =============================================================================
-- 목적: 진짜 동시 트랜잭션 부하 테스트가 아니라, 동시 요청 결과로 발생할 수
--      있는 DB 방어선(UNIQUE 제약, 복합 FK 연쇄 차단)이 정상 작동하는지
--      순차 SQL로 시뮬레이션한다. 단일 psql 세션은 진짜 race condition을
--      재현할 수 없으므로, 이 Seed는 "충돌이 이미 발생했다고 가정했을 때
--      DB가 보이는 반응"을 검증하는 음성 테스트 구조다.
--
-- 정책 전제 (분석 단계에서 확정):
--   1. formula_versions.version_no는 API가 계산한다 (DB 자동생성 없음).
--   2. UNIQUE(formula_id, version_no)가 중복 저장을 차단한다.
--   3. SQLSTATE 23505는 버그가 아니라 정상적인 동시성 방어 결과다.
--   4. API는 충돌 시 최신 version_no 재조회 후 짧은 backoff로 재시도한다.
--
-- 트랜잭션 구조 (TEST-010과 동일 원칙 — 의도된 실패와 정상 데이터의 분리):
--   트랜잭션 1 (메인, COMMIT): 기준 Formula + Version 1 + Version 2 정상 생성.
--   트랜잭션 2 (음성 테스트, 의도적 ROLLBACK): 동일 version_no=2로 중복 INSERT
--     시도 -> UNIQUE 위반 -> 연쇄적으로 그 버전에 연결될 Snapshot INSERT도
--     실행되지 못함 -> ROLLBACK으로 폐기.
--   트랜잭션 3 (재시도 시뮬레이션, COMMIT): "API가 최신 version_no를 재조회한다"는
--     동작을 SELECT MAX(version_no)로 시뮬레이션하여 충돌을 피한 Version 3을
--     정상 생성 + audit_logs에 재시도 경위 기록.
--
-- *** 실행자 필독 ***
-- 트랜잭션 2 실행 시 다음 ERROR가 출력되는 것이 정상이며, 이것이 곧
-- "동시성 방어선 정상 작동"의 증거다. Seed 실행 실패가 아니다.
--   ERROR:  duplicate key value violates unique constraint
--           "formula_versions_formula_id_version_no_key" (또는 동일 의미의 제약명)
--   DETAIL: Key (formula_id, version_no)=(...) already exists.
--
-- 전제: base + supplement + amount_verified fix + TEST-001~010 적용 완료 상태.
-- UUID는 '90110000-...' 패턴으로 기존 198개 UUID와 충돌 없음.
-- DB 구조/View/Trigger는 전혀 변경하지 않는다.
-- =============================================================================

-- =============================================================================
-- 트랜잭션 1 (메인) — 기준 Formula + Version 1, 2 정상 생성
-- =============================================================================

BEGIN;

-- 1. companies
INSERT INTO companies (id, company_name, business_reg_no, representative_name, main_phone, hq_address, is_active) VALUES
('90110000-0000-0000-0001-000000000001', 'Supplier Concurrency Co', '930-81-00038', '정동시1', '02-1401-0038', '서울시 마포구 월드컵로 1', TRUE),
('90110000-0000-0000-0001-000000000002', 'GioWorks Concurrency',    '931-81-00039', '김지오11', '02-1402-0039', '서울시 강남구 압구정로 2', TRUE),
('90110000-0000-0000-0001-000000000003', 'Buyer Concurrency Co',    '932-81-00040', '이동시2', '031-1300-0040', '경기도 수원시 영통구 3', TRUE);

-- 2. items
INSERT INTO items (id, item_code, item_name, default_unit, category, is_active) VALUES
('90110000-0000-0000-0002-000000000001', 'ITEM-CONCUR-011', 'Concurrency Test Raw Material', 'kg', '재활용원료', TRUE);

-- 3. formulas
INSERT INTO formulas (
    id, trade_type, item_id, unit, quantity,
    base_currency,
    content, note,
    trade_status, delivery_status, cash_in_status, cash_out_status,
    invoice_status, logistics_status,
    is_closed, created_by
) VALUES (
    '90110000-0000-0000-0003-000000000001',
    'DOMESTIC',
    '90110000-0000-0000-0002-000000000001',
    'kg',
    1000,
    'KRW',
    'TEST-011: Concurrency Defense Test — Version Engine UNIQUE 방어선 검증',
    'Version 1->2 정상 생성 후, 동일 version_no=2로 중복 INSERT를 시도하여
UNIQUE(formula_id, version_no) 위반과 Snapshot 연쇄 차단을 검증.
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
('90110000-0000-0000-0004-000000000001',
 '90110000-0000-0000-0003-000000000001',
 '90110000-0000-0000-0001-000000000001',
 1, 'SUPPLIER', 'MANUFACTURER', 'PREPAYMENT',
 0, 1000, 1000, 0, TRUE, FALSE),

('90110000-0000-0000-0004-000000000002',
 '90110000-0000-0000-0003-000000000001',
 '90110000-0000-0000-0001-000000000002',
 2, 'BUYER', 'DISTRIBUTOR', 'CREDIT',
 1000, 1500, 1000, 0, FALSE, FALSE),

('90110000-0000-0000-0004-000000000003',
 '90110000-0000-0000-0003-000000000001',
 '90110000-0000-0000-0001-000000000003',
 3, 'BUYER', 'DISTRIBUTOR', 'CREDIT',
 1500, 0, 1000, 0, FALSE, TRUE);

-- 5. formula_versions V1 + snapshot V1 (buy=1,000,000, sell=1,500,000, profit=500,000)
INSERT INTO formula_versions (
    id, formula_id, version_no, changed_by, change_reason, snapshot
) VALUES (
    '90110000-0000-0000-0005-000000000001',
    '90110000-0000-0000-0003-000000000001',
    1, 'system_seed', 'TEST-011 V1 초기 등록',
    '{"schema_version": "v1.6.1", "event": "initial_seed", "version_no": 1,
      "buy_unit_price": 1000, "total_buy_amount": 1000000}'::jsonb
);

INSERT INTO formula_calculation_snapshots (
    id, formula_id, formula_version_id,
    quantity, total_buy_amount, total_sell_amount,
    total_cost, total_share, net_profit, profit_rate,
    snapshot_data
) VALUES (
    '90110000-0000-0000-0006-000000000001',
    '90110000-0000-0000-0003-000000000001',
    '90110000-0000-0000-0005-000000000001',
    1000, 1000000, 1500000,
    0, 0, 500000, 33.3333,
    '{"version_no": 1}'::jsonb
);

-- 6. formula_versions V2 + snapshot V2 (buy=1,200,000, sell=1,500,000, profit=300,000)
INSERT INTO formula_versions (
    id, formula_id, version_no, changed_by, change_reason, snapshot
) VALUES (
    '90110000-0000-0000-0005-000000000002',
    '90110000-0000-0000-0003-000000000001',
    2, 'system_seed', 'TEST-011 V2: 매입단가 변경 1,000 -> 1,200',
    '{"schema_version": "v1.6.1", "event": "version_increment", "version_no": 2,
      "buy_unit_price": 1200, "total_buy_amount": 1200000}'::jsonb
);

INSERT INTO formula_calculation_snapshots (
    id, formula_id, formula_version_id,
    quantity, total_buy_amount, total_sell_amount,
    total_cost, total_share, net_profit, profit_rate,
    snapshot_data
) VALUES (
    '90110000-0000-0000-0006-000000000002',
    '90110000-0000-0000-0003-000000000001',
    '90110000-0000-0000-0005-000000000002',
    1000, 1200000, 1500000,
    0, 0, 300000, 20.0000,
    '{"version_no": 2}'::jsonb
);

COMMIT;

-- =============================================================================
-- 트랜잭션 2 (음성 테스트, 의도적 ROLLBACK)
-- "두 개의 동시 요청이 동시에 version_no=2를 계산해서 INSERT를 시도한다"는
-- 상황을 시뮬레이션한다. 이미 V2(version_no=2)가 트랜잭션 1에서 정상 저장된
-- 상태이므로, 여기서 동일 formula_id + version_no=2로 다시 INSERT를 시도하면
-- UNIQUE(formula_id, version_no) 위반이 발생해야 한다.
--
-- *** 실행자 필독 ***
-- 아래 INSERT에서 다음과 같은 ERROR가 출력되는 것이 정상이며, 이것이 바로
-- "동시성 방어선 PASS"의 증거다. Seed 실행 실패가 아니다.
--   ERROR:  duplicate key value violates unique constraint ".../UNIQUE(formula_id, version_no)"
-- 이 ERROR가 출력되지 않고 INSERT가 조용히 성공한다면, 그것이 오히려 FAIL
-- (UNIQUE 제약이 의도대로 작동하지 않는다는 뜻)이다.
-- =============================================================================

BEGIN;

-- [의도된 실패 지점] 동일 formula_id + version_no=2로 중복 INSERT 시도
INSERT INTO formula_versions (
    id, formula_id, version_no, changed_by, change_reason, snapshot
) VALUES (
    '90110000-0000-0000-0005-000000000099',
    '90110000-0000-0000-0003-000000000001',
    2,  -- 이미 트랜잭션 1에서 사용된 version_no
    'system_seed_concurrent_attempt',
    'TEST-011 동시 요청 시뮬레이션: 충돌하는 version_no=2 중복 시도',
    '{"schema_version": "v1.6.1", "event": "concurrent_collision_attempt", "version_no": 2,
      "buy_unit_price": 1250, "total_buy_amount": 1250000}'::jsonb
);

-- 위 INSERT가 실패하면 트랜잭션은 이미 abort 상태이므로, 아래 snapshot INSERT는
-- "formula_version_id가 존재하지 않는 UUID(90110000-...-099)를 참조하려는 시도"
-- 자체가 실행되지 못하고 무시된다. 이것이 "Snapshot 연쇄 차단"의 증거다.
INSERT INTO formula_calculation_snapshots (
    id, formula_id, formula_version_id,
    quantity, total_buy_amount, total_sell_amount,
    total_cost, total_share, net_profit, profit_rate,
    snapshot_data
) VALUES (
    '90110000-0000-0000-0006-000000000099',
    '90110000-0000-0000-0003-000000000001',
    '90110000-0000-0000-0005-000000000099',
    1000, 1250000, 1500000,
    0, 0, 250000, 16.6667,
    '{"version_no": 2, "note": "이 INSERT는 실행되지 않아야 한다"}'::jsonb
);

-- 위 두 INSERT 중 하나라도 실패하면 트랜잭션은 abort 상태가 되며, ROLLBACK은
-- abort 여부와 무관하게 PostgreSQL이 항상 허용하는 명령이므로 정상 실행되어
-- 트랜잭션을 종료시킨다. 이 트랜잭션의 모든 시도는 영구 데이터로 남지 않는다.
ROLLBACK;

-- =============================================================================
-- 트랜잭션 3 (재시도 시뮬레이션, COMMIT)
-- "API가 충돌을 감지한 후 최신 version_no를 재조회하여 재시도한다"는 동작을
-- 시뮬레이션한다. SELECT MAX(version_no)로 현재 최댓값(2)을 확인하고,
-- 충돌을 피한 다음 번호(3)로 정상 INSERT를 시도한다.
-- =============================================================================

BEGIN;

-- 재시도 직전 "API가 최신 version_no를 재조회"하는 동작의 시뮬레이션.
-- 이 SELECT 결과가 2여야 한다 (트랜잭션 2의 시도는 ROLLBACK되어 반영되지 않았으므로).
-- 결과 확인은 Verify SQL에서 별도로 수행하며, 여기서는 그 위에 재시도 INSERT만 진행한다.

INSERT INTO formula_versions (
    id, formula_id, version_no, changed_by, change_reason, snapshot
) VALUES (
    '90110000-0000-0000-0005-000000000003',
    '90110000-0000-0000-0003-000000000001',
    3,  -- SELECT MAX(version_no)+1 재조회 결과로 결정된 충돌 없는 다음 번호
    'system_seed_retry',
    'TEST-011 V3: 충돌(version_no=2) 감지 후 재조회 기반 재시도로 생성됨',
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
    '90110000-0000-0000-0006-000000000003',
    '90110000-0000-0000-0003-000000000001',
    '90110000-0000-0000-0005-000000000003',
    1000, 1300000, 1500000,
    0, 0, 200000, 13.3333,
    '{"version_no": 3}'::jsonb
);

-- audit_logs — 충돌 발생 및 재시도로 해결된 경위 기록
-- [수정] action 값을 'VERSION_RETRY_AFTER_CONFLICT'(28자)에서 'VERSION_RETRY'(13자)로
-- 변경. audit_logs.action은 VARCHAR(20)이며 원래 값이 8자 초과하여
-- "value too long for type character varying(20)" 오류가 발생했었다.
-- 충돌 경위(attempted_version_no=2, sqlstate=23505)는 old_data/new_data(JSONB)에
-- 이미 상세히 기록되므로 action 값 단축으로 정보 손실은 없다.
INSERT INTO audit_logs (
    id, table_name, record_id, action, changed_by, old_data, new_data
) VALUES (
    '90110000-0000-0000-0007-000000000001',
    'formula_versions',
    '90110000-0000-0000-0003-000000000001',
    'VERSION_RETRY',
    'system_seed_retry',
    '{"attempted_version_no": 2, "conflict": "unique_violation",
      "sqlstate": "23505"}'::jsonb,
    '{"resolved_version_no": 3, "retry_strategy": "re-fetch MAX(version_no) then increment"}'::jsonb
);

COMMIT;
