-- =============================================================================
-- TOCS amount_verified NULL 오류 진단 + 복구 SQL
-- =============================================================================
-- 사용법: STEP 1을 먼저 실행해서 실제 DB 상태를 확인한 뒤,
--         결과를 보고 STEP 2를 실행할지 판단할 것.
-- =============================================================================

-- =============================================================================
-- STEP 1. 진단 — 현재 DB에 실제로 무엇이 적용되어 있는지 확인
-- =============================================================================

-- 1-1. amount_verified 컬럼의 실제 DEFAULT, NOT NULL 여부 확인
SELECT
    column_name,
    is_nullable,
    column_default,
    data_type
FROM information_schema.columns
WHERE table_name = 'formula_invoices'
  AND column_name = 'amount_verified';

-- 예상 결과 (정상이라면):
--   is_nullable = 'NO', column_default = 'false'
-- 만약 column_default가 NULL로 나온다면 -> base.sql이 DEFAULT 없는 구버전으로 적용된 것

-- 1-2. trg_sync_invoice_amount_verified 트리거가 실제로 존재하는지 확인
SELECT
    trigger_name,
    event_manipulation,
    action_timing,
    event_object_table
FROM information_schema.triggers
WHERE event_object_table = 'formula_invoices'
ORDER BY trigger_name;

-- 예상 결과 (정상이라면): trg_check_invoice_participant_company, trg_sync_invoice_amount_verified
-- 2개가 모두 나와야 함. 하나라도 없으면 supplement.sql이 완전히 적용되지 않은 것.

-- 1-3. external_invoice_amount 컬럼이 존재하는지 (RENAME 적용 여부)
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'formula_invoices'
  AND column_name IN ('invoice_amount', 'external_invoice_amount');

-- 예상 결과: 'external_invoice_amount'만 나와야 함.
-- 'invoice_amount'가 그대로 나온다면 supplement.sql의 RENAME 단계가 적용 안 된 것.

-- =============================================================================
-- STEP 2. 복구 — 위 진단 결과 무관하게 안전하게 재적용 (IF NOT EXISTS 패턴)
-- =============================================================================

DO $$
BEGIN
    -- 2-1. DEFAULT가 빠져있다면 다시 설정 (이미 있어도 안전, 덮어쓰기일 뿐)
    ALTER TABLE formula_invoices
        ALTER COLUMN amount_verified SET DEFAULT FALSE;

    -- 혹시 기존에 NULL로 들어간 행이 있다면 먼저 채워줌 (재실행 대비 안전장치)
    UPDATE formula_invoices SET amount_verified = FALSE WHERE amount_verified IS NULL;
END $$;

-- 2-2. 트리거 함수/트리거 재생성 (CREATE OR REPLACE + DROP IF EXISTS로 안전하게)
CREATE OR REPLACE FUNCTION sync_invoice_amount_verified()
RETURNS TRIGGER AS $$
DECLARE
    v_total NUMERIC(18,2);
BEGIN
    v_total := COALESCE(NEW.supply_amount, 0) + COALESCE(NEW.tax_amount, 0);
    IF NEW.external_invoice_amount IS NOT NULL THEN
        NEW.amount_verified := (NEW.external_invoice_amount = v_total);
    ELSE
        NEW.amount_verified := FALSE;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_invoice_amount_verified ON formula_invoices;
CREATE TRIGGER trg_sync_invoice_amount_verified
    BEFORE INSERT OR UPDATE ON formula_invoices
    FOR EACH ROW
    EXECUTE FUNCTION sync_invoice_amount_verified();

-- 2-3. external_invoice_amount 컬럼명 재확인 (없으면 RENAME, 있으면 스킵)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'formula_invoices' AND column_name = 'invoice_amount'
    ) THEN
        ALTER TABLE formula_invoices RENAME COLUMN invoice_amount TO external_invoice_amount;
    END IF;
END $$;

-- =============================================================================
-- STEP 3. 재확인 — STEP 1의 세 쿼리를 다시 실행해서 정상 상태로 바뀌었는지 확인
-- =============================================================================
