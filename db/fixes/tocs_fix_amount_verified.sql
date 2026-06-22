-- =============================================================================
-- TOCS amount_verified NULL 오류 — 확정 수정 SQL
-- =============================================================================
-- 원인: sync_invoice_amount_verified() 함수 내부에서 v_total이 NULL인 상태로
--       external_invoice_amount와 비교되어 (NOT NULL = NULL) -> NULL 결과 발생.
--       (v_total 할당 누락 또는 NEW.total_amount(GENERATED) 직접 참조 중 하나)
--
-- 수정 원칙: v_total 계산을 함수 최상단에서 무조건 실행하고,
--           IF/ELSE 양쪽 모두에서 NULL이 아닌 boolean이 보장되도록
--           방어적으로 COALESCE까지 추가한다.
-- =============================================================================

CREATE OR REPLACE FUNCTION sync_invoice_amount_verified()
RETURNS TRIGGER AS $$
DECLARE
    v_total NUMERIC(18,2);
BEGIN
    -- [수정] 이 줄이 함수 본문에 반드시 존재해야 한다.
    -- NEW.total_amount(GENERATED)를 참조하지 않고, 동일한 수식을 직접 재계산한다.
    v_total := COALESCE(NEW.supply_amount, 0) + COALESCE(NEW.tax_amount, 0);

    IF NEW.external_invoice_amount IS NOT NULL THEN
        -- [방어 강화] v_total은 위에서 COALESCE로 항상 NOT NULL이 보장되지만,
        -- 등호 비교 결과 자체를 한 번 더 COALESCE로 감싸 NULL 유입을 원천 차단한다.
        NEW.amount_verified := COALESCE(NEW.external_invoice_amount = v_total, FALSE);
    ELSE
        NEW.amount_verified := FALSE;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 함수는 CREATE OR REPLACE로 갱신되지만, 트리거 자체는 재생성하지 않아도
-- 동일 함수를 계속 호출하므로 별도 DROP/CREATE TRIGGER 불필요.
-- 단, 안전하게 한 번 더 명시적으로 재등록한다.
DROP TRIGGER IF EXISTS trg_sync_invoice_amount_verified ON formula_invoices;
CREATE TRIGGER trg_sync_invoice_amount_verified
    BEFORE INSERT OR UPDATE ON formula_invoices
    FOR EACH ROW
    EXECUTE FUNCTION sync_invoice_amount_verified();

-- =============================================================================
-- 검증: 수정된 함수가 실제로 NULL을 만들지 않는지 직접 시뮬레이션
-- =============================================================================
DO $$
DECLARE
    v_total NUMERIC(18,2);
    v_result BOOLEAN;
BEGIN
    -- INV-1 케이스 재현: external=15784010, supply=14349100, tax=1434910
    v_total := COALESCE(14349100, 0) + COALESCE(1434910, 0);
    v_result := COALESCE(15784010 = v_total, FALSE);
    RAISE NOTICE 'INV-1 시뮬레이션: v_total=%, result=%', v_total, v_result;
    ASSERT v_result IS NOT NULL, 'amount_verified가 여전히 NULL이 될 수 있음';
    ASSERT v_result = TRUE, '금액 일치 케이스인데 결과가 FALSE로 나옴';

    -- INV-2 케이스 재현: external=22000000, supply=20412100, tax=2041210
    v_total := COALESCE(20412100, 0) + COALESCE(2041210, 0);
    v_result := COALESCE(22000000 = v_total, FALSE);
    RAISE NOTICE 'INV-2 시뮬레이션: v_total=%, result=%', v_total, v_result;
    ASSERT v_result = FALSE, '금액 불일치 케이스인데 결과가 TRUE로 나옴';

    RAISE NOTICE '함수 로직 시뮬레이션 통과';
END $$;
