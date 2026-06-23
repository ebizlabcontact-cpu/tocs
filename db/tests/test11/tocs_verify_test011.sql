-- =============================================================================
-- TOCS TEST-011 View 검증 SQL — Concurrency Defense Test
-- =============================================================================
-- 전제: base + supplement + amount_verified fix + TEST-001~010 + TEST-011 seed
--       순서대로 적용 완료된 상태 (TEST-011 seed의 트랜잭션 2는 의도적으로
--       ROLLBACK되어 데이터가 남지 않음 - 검증 5,6번에서 이를 직접 확인)
--
-- formula_id = '90110000-0000-0000-0003-000000000001'
-- =============================================================================

\echo '=== 1. 기준 Formula 생성 확인 ==='
SELECT formula_no, trade_type, quantity, is_closed
FROM formulas
WHERE id = '90110000-0000-0000-0003-000000000001';

-- 예상값: formula_no는 'FM-2606-%' 형식, quantity=1000, is_closed=FALSE


\echo '=== 2. Version 1 생성 확인 ==='
SELECT version_no, change_reason
FROM formula_versions
WHERE formula_id = '90110000-0000-0000-0003-000000000001' AND version_no = 1;

-- 예상값: version_no=1


\echo '=== 3. Version 2 정상 생성 확인 ==='
SELECT version_no, change_reason
FROM formula_versions
WHERE formula_id = '90110000-0000-0000-0003-000000000001' AND version_no = 2;

-- 예상값: version_no=2


\echo '=== 4-5. 동일 version_no=2 중복 INSERT 시도 결과 + UNIQUE 위반 확인 ==='
-- *** 이 쿼리는 0 rows가 나오는 것이 정상(PASS)이다. ***
-- (트랜잭션 2의 중복 INSERT 시도는 UNIQUE 위반으로 실패 후 ROLLBACK되어
--  id='90110000-0000-0000-0005-000000000099'인 행은 DB에 존재하지 않아야 한다)
SELECT
    COUNT(*) AS duplicate_attempt_residual_count,
    CASE WHEN COUNT(*) = 0 THEN 'PASS (UNIQUE 위반으로 ROLLBACK 정상 적용됨)'
         ELSE 'FAIL (중복 데이터가 남아있음 - UNIQUE 제약 작동 안 함)' END AS unique_defense_check
FROM formula_versions
WHERE id = '90110000-0000-0000-0005-000000000099';

-- [실행자 참고] Seed SQL 실행 시 화면에 다음 ERROR가 출력된 것을 직접
-- 확인했어야 한다. 이 ERROR가 곧 동시성 방어선의 핵심 증거다.
--   ERROR: duplicate key value violates unique constraint
--          ".../formula_versions.../UNIQUE(formula_id, version_no)"
-- 이 ERROR 없이 위 쿼리가 0을 반환했다면(예: 트랜잭션 2 자체가 실행되지
-- 않은 경우), 음성 테스트가 "수행되지 않은 것"이며 "통과한 것"이 아니다.


\echo '=== 6. 실패한 중복 Version에 연결될 Snapshot이 저장되지 않았는지 확인 (연쇄 차단) ==='
-- *** 이 쿼리도 0 rows가 나오는 것이 정상(PASS)이다. ***
SELECT
    COUNT(*) AS orphan_snapshot_count,
    CASE WHEN COUNT(*) = 0 THEN 'PASS (Snapshot 연쇄 차단 정상 작동)'
         ELSE 'FAIL (충돌한 Version에 연결된 Snapshot이 저장됨)' END AS chain_block_check
FROM formula_calculation_snapshots
WHERE id = '90110000-0000-0000-0006-000000000099';

-- 예상값: orphan_snapshot_count=0, PASS
-- (Version INSERT가 실패한 순간 트랜잭션이 abort 상태가 되어, 그 이후
--  같은 트랜잭션 내 Snapshot INSERT 자체가 실행되지 못했어야 한다)


\echo '=== 7. 재시도 시나리오로 Version 3 정상 생성 확인 ==='
SELECT version_no, change_reason, snapshot->>'retry_context' AS retry_context
FROM formula_versions
WHERE formula_id = '90110000-0000-0000-0003-000000000001' AND version_no = 3;

-- 예상값: version_no=3, retry_context에 재조회/재시도 경위 텍스트 포함


\echo '=== 8. Version No 최종 목록이 1,2,3인지 확인 (중복 없이 연속) ==='
SELECT
    array_agg(version_no ORDER BY version_no) AS version_no_list,
    CASE WHEN array_agg(version_no ORDER BY version_no) = ARRAY[1,2,3]::smallint[]
         THEN 'PASS' ELSE 'FAIL' END AS version_list_check
FROM formula_versions
WHERE formula_id = '90110000-0000-0000-0003-000000000001';

-- 예상값: version_no_list={1,2,3}, PASS
-- (버그로 명명된 임시 충돌 시도(version_no=2 중복)는 ROLLBACK되어 목록에
--  영향을 주지 않으며, 최종적으로 1,2,3만 깨끗하게 존재해야 한다)


\echo '=== 9. v_formula_profit_engine이 최신 Version 3 Snapshot을 반영하는지 확인 ==='
-- *** 실행 전 필수 확인 ***
-- 이 쿼리는 tocs_patch_profit_engine_latest_version.sql(TEST-009에서 작성된 패치)
-- 이 적용되어 있어야 정확히 동작한다. 현재 tocs_supplement.sql 자체에는 이
-- 패치가 병합되어 있지 않고 created_at DESC 기준 원본 그대로다.
-- 패치가 적용되지 않은 환경에서는 V2와 V3의 created_at이 같은 트랜잭션 3
-- 안에서 거의 동시에 기록되어 어느 쪽이 선택될지 비결정적일 수 있다.
-- 이 경우 본 쿼리의 FAIL은 TEST-011의 결함이 아니라 "patch 미적용 환경"
-- 문제이므로 반드시 구분해서 보고할 것.
SELECT
    expected_buy, expected_revenue, expected_net_profit,
    CASE WHEN expected_buy = 1300000 AND expected_net_profit = 200000
         THEN 'PASS (V3 최신 snapshot 반영됨)' ELSE 'FAIL' END AS latest_version_check
FROM v_formula_profit_engine
WHERE formula_id = '90110000-0000-0000-0003-000000000001';


\echo '=== 10. formula_no 변경되지 않았는지 확인 ==='
SELECT
    formula_no,
    CASE WHEN formula_no LIKE 'FM-2606-%' THEN 'PASS' ELSE 'FAIL' END AS formula_no_unchanged_check
FROM formulas
WHERE id = '90110000-0000-0000-0003-000000000001';

-- 예상값: PASS (Version 생성/충돌/재시도 전체 과정에서 formula_no는
--        단 한 번도 UPDATE 대상이 아니었음)


\echo '=== 11. audit_logs에 Version 재시도/충돌 관련 기록 확인 ==='
SELECT
    action, changed_by, old_data, new_data,
    CASE WHEN action = 'VERSION_RETRY' THEN 'PASS' ELSE 'FAIL' END AS audit_check
FROM audit_logs
WHERE record_id = '90110000-0000-0000-0003-000000000001'
  AND table_name = 'formula_versions';

-- 예상값: 1건, action='VERSION_RETRY',
--        old_data에 attempted_version_no=2/sqlstate=23505,
--        new_data에 resolved_version_no=3 포함


\echo '=== 12. Expected vs Actual 종합 비교 (PASS/FAIL 자동 판정) ==='
WITH expected(metric, expected_value) AS (
    VALUES
        ('version_count',                3::numeric),
        ('duplicate_attempt_residual',   0::numeric),
        ('orphan_snapshot_count',        0::numeric),
        ('expected_buy_latest',    1300000::numeric),
        ('expected_net_profit_latest', 200000::numeric),
        ('audit_retry_log_count',        1::numeric)
),
counts AS (
    SELECT
        (SELECT COUNT(*) FROM formula_versions WHERE formula_id = '90110000-0000-0000-0003-000000000001') AS version_count,
        (SELECT COUNT(*) FROM formula_versions WHERE id = '90110000-0000-0000-0005-000000000099') AS duplicate_attempt_residual,
        (SELECT COUNT(*) FROM formula_calculation_snapshots WHERE id = '90110000-0000-0000-0006-000000000099') AS orphan_snapshot_count,
        (SELECT COUNT(*) FROM audit_logs WHERE record_id = '90110000-0000-0000-0003-000000000001'
            AND table_name = 'formula_versions' AND action = 'VERSION_RETRY') AS audit_retry_log_count
),
profit AS (
    SELECT expected_buy AS expected_buy_latest, expected_net_profit AS expected_net_profit_latest
    FROM v_formula_profit_engine
    WHERE formula_id = '90110000-0000-0000-0003-000000000001'
),
actual AS (
    SELECT 'version_count'              AS metric, counts.version_count::numeric AS actual_value FROM counts UNION ALL
    SELECT 'duplicate_attempt_residual',          counts.duplicate_attempt_residual::numeric FROM counts UNION ALL
    SELECT 'orphan_snapshot_count',               counts.orphan_snapshot_count::numeric FROM counts UNION ALL
    SELECT 'audit_retry_log_count',               counts.audit_retry_log_count::numeric FROM counts UNION ALL
    SELECT 'expected_buy_latest',                 profit.expected_buy_latest FROM profit UNION ALL
    SELECT 'expected_net_profit_latest',          profit.expected_net_profit_latest FROM profit
)
SELECT
    e.metric, e.expected_value, a.actual_value,
    CASE WHEN e.expected_value = a.actual_value THEN 'PASS' ELSE 'FAIL' END AS result
FROM expected e
JOIN actual a ON a.metric = e.metric
ORDER BY e.metric;

-- 6개 행 전부 result='PASS'가 나와야 정상.
