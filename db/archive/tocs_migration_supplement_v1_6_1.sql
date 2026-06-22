-- =============================================================================
-- TOCS Migration Supplement v1.6.1 (PATCH)
-- Round 7 반영: 2026-06-18
--
-- 목적: v1.6 supplement의 실행 순서 결함 수정
--   문제: total_buy_amount/total_sell_amount DROP COLUMN 시
--         View(v_participant_confirmed_kpi, v_formula_profit_engine 등)가
--         해당 컬럼을 참조하므로 DROP이 실패함.
--
-- 이 파일은 v1.6 supplement를 대체한다. (v1.6 대신 이 파일을 실행할 것)
-- 전제: v1.5 schema + v1.5 supplement 적용 완료 상태
-- =============================================================================

BEGIN;

-- =============================================================================
-- STEP 1. 의존 View 전체 DROP
-- (total_buy_amount / total_sell_amount를 참조하는 모든 View)
-- =============================================================================

DROP VIEW IF EXISTS v_formula_closeable;
DROP VIEW IF EXISTS v_payment_unmatched;
DROP VIEW IF EXISTS v_formula_invoice_status;
DROP VIEW IF EXISTS v_formula_profit_engine;
DROP VIEW IF EXISTS v_participant_confirmed_kpi;
DROP VIEW IF EXISTS v_formula_confirmed_kpi;

-- =============================================================================
-- STEP 2. [B-1] formula_participants.quantity NOT NULL 전환
-- =============================================================================

-- 운영 전 단계 가정. 데이터 존재 시 아래 UPDATE 선행:
-- UPDATE formula_participants fp SET quantity = f.quantity
--   FROM formulas f WHERE fp.formula_id = f.id AND fp.quantity IS NULL;

ALTER TABLE formula_participants
    ALTER COLUMN quantity SET NOT NULL;

-- Generated Column 재생성 (이제 View 의존성이 제거되었으므로 안전하게 DROP 가능)
ALTER TABLE formula_participants DROP COLUMN IF EXISTS total_buy_amount;
ALTER TABLE formula_participants DROP COLUMN IF EXISTS total_sell_amount;

ALTER TABLE formula_participants
    ADD COLUMN total_buy_amount NUMERIC(18,2)
        GENERATED ALWAYS AS (quantity * buy_unit_price) STORED,
    ADD COLUMN total_sell_amount NUMERIC(18,2)
        GENERATED ALWAYS AS (quantity * sell_unit_price) STORED;

COMMENT ON COLUMN formula_participants.quantity IS
'[v1.6] NOT NULL. participant 생성 시 quantity 미지정이면 API 레이어에서 formula.quantity 자동 상속.
formula.quantity와 다른 값으로 명시 입력 가능 (검수차이 등 실무 변동 수용).
DB 레벨에서 formula.quantity와 동일함을 강제하지 않음 — 의도된 정책.';

-- =============================================================================
-- STEP 3. [B-2] formula_shares 복합 FK
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
-- STEP 4. [B-3] formula_calculation_snapshots 복합 FK
-- =============================================================================

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_fv_id_formula') THEN
        ALTER TABLE formula_versions
            ADD CONSTRAINT uq_fv_id_formula UNIQUE (id, formula_id);
    END IF;
END $$;

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
-- STEP 5. [B-4] Payment Schedule ↔ Record 방향 일치 트리거
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

-- =============================================================================
-- STEP 6. [B-5] Invoice Participant ↔ Company 일치 트리거
-- =============================================================================

CREATE OR REPLACE FUNCTION check_invoice_participant_company_match()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.issuer_participant_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM formula_participants
            WHERE id = NEW.issuer_participant_id AND company_id = NEW.issuer_company_id
        ) THEN
            RAISE EXCEPTION 'issuer_participant_id (%) company does not match issuer_company_id (%)',
                NEW.issuer_participant_id, NEW.issuer_company_id;
        END IF;
    END IF;
    IF NEW.receiver_participant_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM formula_participants
            WHERE id = NEW.receiver_participant_id AND company_id = NEW.receiver_company_id
        ) THEN
            RAISE EXCEPTION 'receiver_participant_id (%) company does not match receiver_company_id (%)',
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
-- STEP 7. [B-6] invoice_amount → external_invoice_amount
-- =============================================================================

DO $$ BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'formula_invoices' AND column_name = 'invoice_amount'
    ) THEN
        ALTER TABLE formula_invoices RENAME COLUMN invoice_amount TO external_invoice_amount;
    END IF;
END $$;

COMMENT ON COLUMN formula_invoices.external_invoice_amount IS
'외부(거래처) 발행 계산서 원본 표시 금액. total_amount(GENERATED)와 비교하여 amount_verified 자동 계산.';

-- =============================================================================
-- STEP 8. [Round 7] amount_verified 자동 계산 트리거 (신규)
-- =============================================================================

CREATE OR REPLACE FUNCTION sync_invoice_amount_verified()
RETURNS TRIGGER AS $$
DECLARE
    v_total NUMERIC(18,2);
BEGIN
    -- GENERATED 컬럼(total_amount)은 BEFORE 트리거 시점에 미확정이므로 동일 수식 재계산
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

COMMENT ON FUNCTION sync_invoice_amount_verified() IS
'[Round 7] external_invoice_amount = total_amount 비교하여 amount_verified 자동 설정.
invoice_status(AMOUNT_MATCHED/AMOUNT_MISMATCHED) 전환은 API 레이어가 amount_verified를 참고해 결정.
트리거가 invoice_status를 직접 덮어쓰지 않음 (REVISION_REQUIRED, CANCELED 등 실무자 지정 상태 보호).';

-- =============================================================================
-- STEP 9. Partial Unique Index + CHECK (의존성 없으므로 순서 무관, 여기서 처리)
-- =============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS uq_fp_one_start_point
    ON formula_participants(formula_id) WHERE is_start_point = TRUE;

CREATE UNIQUE INDEX IF NOT EXISTS uq_fp_one_end_point
    ON formula_participants(formula_id) WHERE is_end_point = TRUE;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_sequence_order_positive') THEN
        ALTER TABLE formula_participants
            ADD CONSTRAINT chk_sequence_order_positive CHECK (sequence_order > 0);
    END IF;
END $$;

-- =============================================================================
-- STEP 10. View 재생성 (컬럼명 동일하므로 정의 변경 없음. DROP했던 6개 모두 복원)
-- =============================================================================

CREATE OR REPLACE VIEW v_formula_confirmed_kpi AS
WITH
confirmed AS (
    SELECT formula_id,
        SUM(actual_amount) FILTER (WHERE direction = 'IN')  AS confirmed_in,
        SUM(actual_amount) FILTER (WHERE direction = 'OUT') AS confirmed_out
    FROM formula_payment_records
    WHERE status = 'COMPLETED' AND NOT is_canceled
    GROUP BY formula_id
),
scheduled AS (
    SELECT formula_id,
        SUM(scheduled_amount) FILTER (WHERE direction = 'IN')  AS scheduled_in,
        SUM(scheduled_amount) FILTER (WHERE direction = 'OUT') AS scheduled_out
    FROM formula_payment_schedules
    GROUP BY formula_id
)
SELECT
    f.id AS formula_id, f.formula_no,
    f.cash_in_status, f.cash_out_status,
    COALESCE(c.confirmed_in,  0) AS confirmed_revenue,
    COALESCE(c.confirmed_out, 0) AS confirmed_payment,
    COALESCE(s.scheduled_in,  0) AS scheduled_revenue,
    COALESCE(s.scheduled_out, 0) AS scheduled_payment,
    COALESCE(s.scheduled_in,  0) - COALESCE(c.confirmed_in,  0) AS receivable,
    COALESCE(s.scheduled_out, 0) - COALESCE(c.confirmed_out, 0) AS payable,
    CASE WHEN COALESCE(s.scheduled_in,  0) = 0 THEN NULL
         ELSE ROUND(COALESCE(c.confirmed_in,  0) / s.scheduled_in  * 100, 2) END AS receive_rate,
    CASE WHEN COALESCE(s.scheduled_out, 0) = 0 THEN NULL
         ELSE ROUND(COALESCE(c.confirmed_out, 0) / s.scheduled_out * 100, 2) END AS payment_rate
FROM formulas f
LEFT JOIN confirmed c ON c.formula_id = f.id
LEFT JOIN scheduled s ON s.formula_id = f.id;

CREATE OR REPLACE VIEW v_participant_confirmed_kpi AS
WITH
sched AS (
    SELECT formula_id, participant_id,
        SUM(scheduled_amount) FILTER (WHERE direction = 'IN')  AS scheduled_in,
        SUM(scheduled_amount) FILTER (WHERE direction = 'OUT') AS scheduled_out
    FROM formula_payment_schedules GROUP BY formula_id, participant_id
),
actual AS (
    SELECT formula_id, participant_id,
        SUM(actual_amount) FILTER (WHERE direction = 'IN')  AS confirmed_in,
        SUM(actual_amount) FILTER (WHERE direction = 'OUT') AS confirmed_out
    FROM formula_payment_records
    WHERE status = 'COMPLETED' AND NOT is_canceled
    GROUP BY formula_id, participant_id
)
SELECT
    fp.formula_id, f.formula_no,
    fp.id AS participant_id, fp.company_id, c.company_name,
    fp.role_group, fp.sequence_order,
    fp.total_buy_amount, fp.total_sell_amount,
    COALESCE(a.confirmed_in,  0) AS confirmed_in,
    COALESCE(a.confirmed_out, 0) AS confirmed_out,
    COALESCE(s.scheduled_in,  0) AS scheduled_in,
    COALESCE(s.scheduled_out, 0) AS scheduled_out,
    COALESCE(s.scheduled_in,  0) - COALESCE(a.confirmed_in,  0)  AS receivable,
    COALESCE(s.scheduled_out, 0) - COALESCE(a.confirmed_out, 0)  AS payable,
    COALESCE(a.confirmed_in,  0) - COALESCE(a.confirmed_out, 0)  AS confirmed_net_profit
FROM formula_participants fp
JOIN formulas  f ON f.id = fp.formula_id
JOIN companies c ON c.id = fp.company_id
LEFT JOIN sched  s ON s.formula_id = fp.formula_id AND s.participant_id = fp.id
LEFT JOIN actual a ON a.formula_id = fp.formula_id AND a.participant_id = fp.id;

CREATE OR REPLACE VIEW v_formula_profit_engine AS
WITH profit_base AS (
    SELECT formula_id,
        SUM(actual_amount) FILTER (WHERE direction = 'IN')  AS confirmed_in,
        SUM(actual_amount) FILTER (WHERE direction = 'OUT') AS confirmed_out
    FROM formula_payment_records
    WHERE status = 'COMPLETED' AND NOT is_canceled GROUP BY formula_id
),
expected_base AS (
    SELECT DISTINCT ON (formula_id) formula_id,
        net_profit AS expected_net_profit, profit_rate AS expected_profit_rate,
        total_sell_amount, total_buy_amount, total_cost, total_share
    FROM formula_calculation_snapshots ORDER BY formula_id, created_at DESC
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

CREATE OR REPLACE VIEW v_formula_invoice_status AS
SELECT
    f.id AS formula_id, f.formula_no,
    COUNT(fi.id) FILTER (WHERE fi.status != 'CANCELED')                        AS active_count,
    COUNT(fi.id) FILTER (WHERE fi.status = 'REVISION_REQUIRED')                AS revision_count,
    COUNT(fi.id) FILTER (WHERE fi.status = 'AMOUNT_MISMATCHED')                AS mismatched_count,
    COUNT(fi.id) FILTER (WHERE fi.status IN ('NOT_ISSUED','ISSUED','RECEIVED')) AS in_progress_count,
    COUNT(fi.id) FILTER (WHERE fi.status = 'AMOUNT_MATCHED')                   AS matched_count,
    CASE
        WHEN COUNT(fi.id) FILTER (WHERE fi.status != 'CANCELED') = 0 THEN 'NOT_ISSUED'
        WHEN COUNT(fi.id) FILTER (WHERE fi.status = 'REVISION_REQUIRED') > 0 THEN 'REVISION_REQUIRED'
        WHEN COUNT(fi.id) FILTER (WHERE fi.status = 'AMOUNT_MISMATCHED') > 0 THEN 'AMOUNT_MISMATCHED'
        WHEN COUNT(fi.id) FILTER (WHERE fi.status IN ('NOT_ISSUED','ISSUED','RECEIVED')) > 0 THEN 'ISSUED'
        WHEN COUNT(fi.id) FILTER (WHERE fi.status != 'CANCELED')
           = COUNT(fi.id) FILTER (WHERE fi.status = 'AMOUNT_MATCHED')
           AND COUNT(fi.id) FILTER (WHERE fi.status != 'CANCELED') > 0 THEN 'AMOUNT_MATCHED'
        ELSE 'NOT_ISSUED'
    END::invoice_status AS derived_invoice_status
FROM formulas f
LEFT JOIN formula_invoices fi ON fi.formula_id = f.id
GROUP BY f.id, f.formula_no;

CREATE OR REPLACE VIEW v_payment_unmatched AS
SELECT
    r.id, r.formula_id, f.formula_no,
    r.direction, r.actual_amount, r.actual_date,
    r.bank_name, r.account_no, r.status, r.memo, r.created_at
FROM formula_payment_records r
JOIN formulas f ON f.id = r.formula_id
WHERE r.payment_schedule_id IS NULL AND NOT r.is_canceled;

CREATE OR REPLACE VIEW v_formula_closeable AS
SELECT
    f.id AS formula_id, f.formula_no,
    f.trade_status     = 'COMPLETED'      AS trade_done,
    f.delivery_status  = 'COMPLETED'      AS delivery_done,
    f.cash_in_status   = 'COMPLETED'      AS cash_in_done,
    f.cash_out_status  = 'COMPLETED'      AS cash_out_done,
    f.invoice_status   = 'AMOUNT_MATCHED' AS invoice_done,
    f.logistics_status = 'COMPLETED'      AS logistics_done,
    (
        f.trade_status     = 'COMPLETED' AND
        f.delivery_status  = 'COMPLETED' AND
        f.cash_in_status   = 'COMPLETED' AND
        f.cash_out_status  = 'COMPLETED' AND
        f.invoice_status   = 'AMOUNT_MATCHED' AND
        f.logistics_status = 'COMPLETED'
    ) AS can_close,
    f.is_closed
FROM formulas f;

COMMIT;
