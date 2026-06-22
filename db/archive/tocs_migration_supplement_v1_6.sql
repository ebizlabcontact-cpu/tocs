-- =============================================================================
-- TOCS Migration Supplement v1.6
-- v1.5 적용 완료 상태를 전제로 한 증분 패치
-- Round 6 반영: 2026-06-18
--
-- 적용 순서: v1.5 schema + v1.5 supplement 적용 완료 후 이 파일 실행
-- =============================================================================

-- =============================================================================
-- [B-1] formula_participants.quantity NOT NULL 전환
-- =============================================================================

-- 운영 전 단계이므로 기존 NULL 데이터 없음 가정.
-- 데이터 존재 시 아래 UPDATE를 먼저 실행할 것:
-- UPDATE formula_participants fp
--   SET quantity = f.quantity
--   FROM formulas f
--   WHERE fp.formula_id = f.id AND fp.quantity IS NULL;

ALTER TABLE formula_participants
    ALTER COLUMN quantity SET NOT NULL;

-- GENERATED 컬럼 재정의 (COALESCE 제거: NULL 불가능해졌으므로 단순화)
ALTER TABLE formula_participants DROP COLUMN IF EXISTS total_buy_amount;
ALTER TABLE formula_participants DROP COLUMN IF EXISTS total_sell_amount;

ALTER TABLE formula_participants
    ADD COLUMN total_buy_amount NUMERIC(18,2)
        GENERATED ALWAYS AS (quantity * buy_unit_price) STORED,
    ADD COLUMN total_sell_amount NUMERIC(18,2)
        GENERATED ALWAYS AS (quantity * sell_unit_price) STORED;

COMMENT ON COLUMN formula_participants.quantity IS
'[v1.6] NOT NULL 전환. participant 생성 시 quantity 미지정이면 API 레이어에서 formula.quantity를 자동 상속.';

-- =============================================================================
-- [B-2] formula_shares 복합 FK
-- =============================================================================

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_share_participant_formula') THEN
        ALTER TABLE formula_shares
            ADD CONSTRAINT fk_share_participant_formula
                FOREIGN KEY (participant_id, formula_id)
                REFERENCES formula_participants(id, formula_id)
                MATCH SIMPLE;
    END IF;
END $$;

-- =============================================================================
-- [B-3] formula_calculation_snapshots 복합 FK
-- =============================================================================

-- Step 1: formula_versions 복합 UNIQUE 추가
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_fv_id_formula') THEN
        ALTER TABLE formula_versions
            ADD CONSTRAINT uq_fv_id_formula UNIQUE (id, formula_id);
    END IF;
END $$;

-- Step 2: snapshot 복합 FK
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_snapshot_version_formula') THEN
        ALTER TABLE formula_calculation_snapshots
            ADD CONSTRAINT fk_snapshot_version_formula
                FOREIGN KEY (formula_version_id, formula_id)
                REFERENCES formula_versions(id, formula_id)
                MATCH SIMPLE;
    END IF;
END $$;

-- =============================================================================
-- [B-4] Payment Schedule ↔ Record 방향 일치 트리거
-- =============================================================================

CREATE OR REPLACE FUNCTION check_record_direction_matches_schedule()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.payment_schedule_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM formula_payment_schedules
            WHERE id = NEW.payment_schedule_id
              AND direction = NEW.direction
        ) THEN
            RAISE EXCEPTION
                'formula_payment_records.direction (%) does not match schedule direction for schedule_id %',
                NEW.direction, NEW.payment_schedule_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_record_direction ON formula_payment_records;
CREATE TRIGGER trg_check_record_direction
    BEFORE INSERT OR UPDATE ON formula_payment_records
    FOR EACH ROW
    EXECUTE FUNCTION check_record_direction_matches_schedule();

COMMENT ON FUNCTION check_record_direction_matches_schedule() IS
'[v1.6 B-4] payment_schedule_id 연결 시 record.direction = schedule.direction 강제.
participant_id 일치는 API 레이어 검증 가이드로 별도 처리 (formula 단위는 복합 FK로 이미 보장).';

-- =============================================================================
-- [B-5] Invoice Participant ↔ Company 일치 트리거
-- =============================================================================

CREATE OR REPLACE FUNCTION check_invoice_participant_company_match()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.issuer_participant_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM formula_participants
            WHERE id = NEW.issuer_participant_id
              AND company_id = NEW.issuer_company_id
        ) THEN
            RAISE EXCEPTION
                'issuer_participant_id (%) company does not match issuer_company_id (%)',
                NEW.issuer_participant_id, NEW.issuer_company_id;
        END IF;
    END IF;

    IF NEW.receiver_participant_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM formula_participants
            WHERE id = NEW.receiver_participant_id
              AND company_id = NEW.receiver_company_id
        ) THEN
            RAISE EXCEPTION
                'receiver_participant_id (%) company does not match receiver_company_id (%)',
                NEW.receiver_participant_id, NEW.receiver_company_id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_invoice_participant_company ON formula_invoices;
CREATE TRIGGER trg_check_invoice_participant_company
    BEFORE INSERT OR UPDATE ON formula_invoices
    FOR EACH ROW
    EXECUTE FUNCTION check_invoice_participant_company_match();

-- =============================================================================
-- [B-6] invoice_amount → external_invoice_amount 명칭/역할 변경
-- =============================================================================

ALTER TABLE formula_invoices
    RENAME COLUMN invoice_amount TO external_invoice_amount;

COMMENT ON COLUMN formula_invoices.external_invoice_amount IS
'[v1.6 B-6] 외부(거래처)가 발행한 계산서 원본 표시 금액. 자유 입력.
total_amount(GENERATED: supply_amount+tax_amount)와 비교하여 검증:
  일치 → amount_verified=TRUE, status 후보 AMOUNT_MATCHED
  불일치 → amount_verified=FALSE, status 후보 AMOUNT_MISMATCHED';

-- =============================================================================
-- 추가-1. 시작점/종료점 Partial Unique Index
-- =============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS uq_fp_one_start_point
    ON formula_participants(formula_id) WHERE is_start_point = TRUE;

CREATE UNIQUE INDEX IF NOT EXISTS uq_fp_one_end_point
    ON formula_participants(formula_id) WHERE is_end_point = TRUE;

COMMENT ON INDEX uq_fp_one_start_point IS 'Formula당 시작점(is_start_point=TRUE)은 최대 1개만 허용.';
COMMENT ON INDEX uq_fp_one_end_point   IS 'Formula당 종료점(is_end_point=TRUE)은 최대 1개만 허용.';

-- =============================================================================
-- 추가-2. sequence_order 양수 CHECK
-- =============================================================================

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_sequence_order_positive') THEN
        ALTER TABLE formula_participants
            ADD CONSTRAINT chk_sequence_order_positive CHECK (sequence_order > 0);
    END IF;
END $$;
