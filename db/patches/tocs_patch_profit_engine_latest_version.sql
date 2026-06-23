-- =============================================================================
-- TOCS Patch — v_formula_profit_engine Latest Snapshot 선택 기준 수정
-- =============================================================================
-- 분류: Version Engine을 위한 View 설계 결함 수정 (TEST-009에서 식별)
--
-- 원인:
--   v_formula_profit_engine의 expected_base CTE가 "최신 snapshot"을
--   formula_calculation_snapshots.created_at DESC 단일 기준으로 선택했다.
--   PostgreSQL의 now()/NOW()는 statement_timestamp 기반이지만 같은
--   BEGIN~COMMIT 트랜잭션 내에서 짧은 간격으로 연속 실행되는 INSERT 문들의
--   created_at(DEFAULT NOW())이 동일한 값으로 기록될 수 있다. 이 경우
--   PostgreSQL DISTINCT ON은 동일 정렬키 그룹 내 행 선택 결과를
--   "unspecified"로 규정하므로, 어느 snapshot이 선택될지 보장되지 않는다.
--   실제로 TEST-009에서 V2(최신, version_no=2)가 아닌 V1(version_no=1)이
--   선택되는 FAIL이 재현되었다.
--
-- 수정 방향:
--   "최신"의 판단 기준을 시간(created_at)이 아니라 버전 순서
--   (formula_versions.version_no)로 변경한다. version_no는 단조 증가하는
--   명시적 컬럼이므로 동시성에 노출되지 않는다.
--   created_at, id는 동일 formula_id 내 version_no까지 같은 극단적 경우를
--   위한 tie-breaker로만 보조 사용한다(통상 발생하지 않음: version_no는
--   formula_versions에 UNIQUE(formula_id, version_no)로 보장되어 동일
--   formula_id+version_no 조합은 존재할 수 없다. 다만 한 version_no에
--   대해 snapshot이 여러 건 존재하는 비정상 데이터가 있을 경우를 대비한
--   방어적 안전장치다).
--
-- 수정 범위: v_formula_profit_engine의 expected_base CTE만 교체.
--   profit_base CTE, 외부 SELECT의 컬럼 목록과 alias, FROM/LEFT JOIN 구조는
--   전혀 변경하지 않는다. 다른 View, 테이블, Trigger는 건드리지 않는다.
--
-- 전제: base + supplement + amount_verified fix + TEST-001~009 적용 완료 상태.
-- =============================================================================

CREATE OR REPLACE VIEW v_formula_profit_engine AS
WITH profit_base AS (
    SELECT formula_id,
        SUM(actual_amount) FILTER (WHERE direction = 'IN')  AS confirmed_in,
        SUM(actual_amount) FILTER (WHERE direction = 'OUT') AS confirmed_out
    FROM formula_payment_records
    WHERE status = 'COMPLETED' AND NOT is_canceled GROUP BY formula_id
),
expected_base AS (
    -- [수정] formula_calculation_snapshots와 formula_versions를 LEFT JOIN하여
    -- "최신"의 1차 기준을 fv.version_no DESC로 변경.
    -- LEFT JOIN을 사용한 이유: formula_calculation_snapshots.formula_version_id는
    -- nullable FK이며, 향후 운영 데이터에서 NULL인 snapshot이 생겨도
    -- (version_no는 NULL로 처리되어 정렬 최하위로 밀릴 뿐) 해당 formula_id가
    -- expected_base에서 통째로 누락되지 않도록 한다. INNER JOIN을 쓰면
    -- formula_version_id가 NULL인 snapshot을 가진 formula 전체가 사라진다.
    SELECT DISTINCT ON (fcs.formula_id) fcs.formula_id,
        fcs.net_profit AS expected_net_profit, fcs.profit_rate AS expected_profit_rate,
        fcs.total_sell_amount, fcs.total_buy_amount, fcs.total_cost, fcs.total_share
    FROM formula_calculation_snapshots fcs
    LEFT JOIN formula_versions fv ON fv.id = fcs.formula_version_id
    ORDER BY fcs.formula_id, fv.version_no DESC, fcs.created_at DESC, fcs.id DESC
)
SELECT
    f.id AS formula_id, f.formula_no,
    COALESCE(p.confirmed_in,  0) AS confirmed_revenue,
    COALESCE(p.confirmed_out, 0) AS confirmed_cost_total,
    COALESCE(p.confirmed_in,  0) - COALESCE(p.confirmed_out, 0) AS confirmed_net_profit,
    COALESCE(e.total_sell_amount,   0) AS expected_revenue,
    COALESCE(e.total_buy_amount,    0) AS expected_buy,
    COALESCE(e.total_cost,          0) AS expected_cost,
    COALESCE(e.total_share,         0) AS expected_share,
    COALESCE(e.expected_net_profit, 0) AS expected_net_profit,
    COALESCE(e.expected_profit_rate,0) AS expected_profit_rate
FROM formulas f
LEFT JOIN profit_base   p ON p.formula_id = f.id
LEFT JOIN expected_base e ON e.formula_id = f.id;
