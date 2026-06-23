-- =============================================================================
-- TOCS TEST-011B View 검증 SQL — Concurrency Defense Test (재생성)
-- =============================================================================
-- 전제: base + supplement + amount_verified fix + TEST-001~010
--      + TEST-011(1차, V1/V2까지 COMMIT) + TEST-011B seed 적용 완료 상태
--
-- 이 Verify는 TEST-011B 데이터(formula_id='9012b000-...')만 조회한다.
-- 기존 TEST-011(formula_id='90110000-...')은 건드리지 않는다.
-- =============================================================================

\echo '=== 1. Formula 생성 확인 ==='
SELECT formula_no, trade_type, quantity, is_closed
FROM formulas
WHERE id = '9012b000-0000-0000-0003-000000000001';

-- 예상값: formula_no는 'FM-2606-%' 형식, quantity=1000, is_closed=FALSE


\echo '=== 2. Version 1 확인 ==='
SELECT version_no, change_reason
FROM formula_versions
WHERE formula_id = '9012b000-0000-0000-0003-000000000001' AND version_no = 1;

-- 예상값: version_no=1


\echo '=== 3. Version 2 확인 ==='
SELECT version_no, change_reason
FROM formula_versions
WHERE formula_id = '9012b000-0000-0000-0003-000000000001' AND version_no = 2;

-- 예상값: version_no=2


\echo '=== 4. 중복 version_no=2 시도 후 잔여 데이터 0건 확인 ==='
-- *** 이 쿼리는 0 rows가 나오는 것이 정상(PASS)이다. ***
SELECT
    COUNT(*) AS duplicate_attempt_residual_count,
    CASE WHEN COUNT(*) = 0 THEN 'PASS (UNIQUE 위반으로 ROLLBACK 정상 적용됨)'
         ELSE 'FAIL (중복 데이터가 남아있음)' END AS unique_defense_check
FROM formula_versions
WHERE id = '9012b000-0000-0000-0005-000000000099';

-- [실행자 참고] Seed SQL 실행 시 화면에 다음 ERROR가 출력된 것을 직접
-- 확인했어야 한다 - 이것이 음성 테스트의 핵심 증거다.
--   ERROR: duplicate key value violates unique constraint
--          ".../formula_versions.../UNIQUE(formula_id, version_no)"


\echo '=== 5. 실패한 중복 Version에 연결될 orphan snapshot 0건 확인 ==='
-- *** 이 쿼리도 0 rows가 나오는 것이 정상(PASS)이다. ***
SELECT
    COUNT(*) AS orphan_snapshot_count,
    CASE WHEN COUNT(*) = 0 THEN 'PASS (Snapshot 연쇄 차단 정상 작동)'
         ELSE 'FAIL (충돌한 Version에 연결된 Snapshot이 저장됨)' END AS chain_block_check
FROM formula_calculation_snapshots
WHERE id = '9012b000-0000-0000-0006-000000000099';


\echo '=== 6. Version 3 정상 생성 확인 ==='
SELECT version_no, change_reason, snapshot->>'retry_context' AS retry_context
FROM formula_versions
WHERE formula_id = '9012b000-0000-0000-0003-000000000001' AND version_no = 3;

-- 예상값: version_no=3, retry_context에 재조회/재시도 경위 텍스트 포함


\echo '=== 7. version_no 최종 목록이 {1,2,3}인지 확인 ==='
SELECT
    array_agg(version_no ORDER BY version_no) AS version_no_list,
    CASE WHEN array_agg(version_no ORDER BY version_no) = ARRAY[1,2,3]::smallint[]
         THEN 'PASS' ELSE 'FAIL' END AS version_list_check
FROM formula_versions
WHERE formula_id = '9012b000-0000-0000-0003-000000000001';

-- 예상값: version_no_list={1,2,3}, PASS


\echo '=== 8. v_formula_profit_engine이 V3 Snapshot을 최신으로 반영하는지 확인 ==='
-- *** 실행 전 필수 확인 ***
-- 이 쿼리는 tocs_patch_profit_engine_latest_version.sql(TEST-009에서 작성된 패치)
-- 이 적용되어 있어야 정확히 동작한다. 패치 미적용 시 created_at 기준으로
-- 동작하여 비결정적 결과가 나올 수 있으며, 그 FAIL은 TEST-011B의 결함이
-- 아니라 환경 설정 누락이므로 반드시 구분해서 보고할 것.
SELECT
    expected_buy, expected_revenue, expected_net_profit,
    CASE WHEN expected_buy = 1300000 AND expected_net_profit = 200000
         THEN 'PASS (V3 최신 snapshot 반영됨)' ELSE 'FAIL' END AS latest_version_check
FROM v_formula_profit_engine
WHERE formula_id = '9012b000-0000-0000-0003-000000000001';

-- 예상값: expected_buy=1,300,000, expected_net_profit=200,000


\echo '=== 9. formula_no 유지 확인 ==='
SELECT
    formula_no,
    CASE WHEN formula_no LIKE 'FM-2606-%' THEN 'PASS' ELSE 'FAIL' END AS formula_no_unchanged_check
FROM formulas
WHERE id = '9012b000-0000-0000-0003-000000000001';

-- 예상값: PASS


\echo '=== 10. audit_logs에 VERSION_RETRY 기록 확인 ==='
SELECT
    action, changed_by, old_data, new_data,
    CASE WHEN action = 'VERSION_RETRY' THEN 'PASS' ELSE 'FAIL' END AS audit_check
FROM audit_logs
WHERE record_id = '9012b000-0000-0000-0003-000000000001'
  AND table_name = 'formula_versions';

-- 예상값: 1건, action='VERSION_RETRY',
--        old_data에 attempted_version_no=2/sqlstate=23505,
--        new_data에 resolved_version_no=3 포함


\echo '=== 11. Expected vs Actual 종합 비교 (PASS/FAIL 자동 판정) ==='
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
        (SELECT COUNT(*) FROM formula_versions WHERE formula_id = '9012b000-0000-0000-0003-000000000001') AS version_count,
        (SELECT COUNT(*) FROM formula_versions WHERE id = '9012b000-0000-0000-0005-000000000099') AS duplicate_attempt_residual,
        (SELECT COUNT(*) FROM formula_calculation_snapshots WHERE id = '9012b000-0000-0000-0006-000000000099') AS orphan_snapshot_count,
        (SELECT COUNT(*) FROM audit_logs WHERE record_id = '9012b000-0000-0000-0003-000000000001'
            AND table_name = 'formula_versions' AND action = 'VERSION_RETRY') AS audit_retry_log_count
),
profit AS (
    SELECT expected_buy AS expected_buy_latest, expected_net_profit AS expected_net_profit_latest
    FROM v_formula_profit_engine
    WHERE formula_id = '9012b000-0000-0000-0003-000000000001'
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


\echo '=== 12. 기존 TEST-011 데이터는 영향받지 않았는지 별도 확인 (참고용) ==='
SELECT
    (SELECT array_agg(version_no ORDER BY version_no) FROM formula_versions
        WHERE formula_id = '90110000-0000-0000-0003-000000000001') AS test011_original_version_list;

-- 참고용: TEST-011(원본)의 version_no_list가 여전히 {1,2}인지 확인(변경되지 않았어야 함).
-- 이 쿼리는 TEST-011B의 PASS/FAIL 판정에는 포함하지 않으며, 데이터 격리 확인용이다.
