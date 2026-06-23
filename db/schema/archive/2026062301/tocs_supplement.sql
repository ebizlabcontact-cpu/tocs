-- =============================================================================
-- TOCS Migration Supplement (Final)
-- =============================================================================
-- 전제: tocs_base_schema.sql 이 이미 실행 완료된 상태.
-- 이 파일이 추가하는 것 (base에는 없는 것만):
--   1. cash_in/cash_out 포함 종결 CHECK
--   2. GENERATED 컬럼 (formula_participants.total_buy/sell_amount,
--      formula_invoices.total_amount)
--   3. 선행 복합 UNIQUE (formula_versions.uq_fv_id_formula)
--   4. 복합 FK (MATCH SIMPLE) 5개 — 교차 formula 오염 방지
--   5. 트리거 2개 — direction 일치, invoice participant/company 일치
--   6. invoice_amount → external_invoice_amount RENAME
--   7. amount_verified 자동 계산 트리거
--   8. Partial Unique Index (시작점/종료점), sequence_order CHECK
--   9. Partial Index (KPI 집계용 등)
--   10. View 6개
--
-- 트랜잭션 1개로 묶어 원자성 보장.
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. formulas: cash_in/cash_out 포함 종결 CHECK
--    (base.sql에는 이 CHECK가 없음 — 여기서 처음 추가)
-- =============================================================================

ALTER TABLE formulas
    ADD CONSTRAINT chk_closed_requires_all_completed CHECK (
        NOT is_closed OR (
            trade_status     = 'COMPLETED' AND
            delivery_status  = 'COMPLETED' AND
            cash_in_status   = 'COMPLETED' AND
            cash_out_status  = 'COMPLETED' AND
            invoice_status   = 'AMOUNT_MATCHED' AND
            logistics_status = 'COMPLETED'
        )
    );

-- =============================================================================
-- 2. formula_participants: GENERATED 컬럼 추가
--    (base.sql의 quantity는 이미 NOT NULL이므로 COALESCE 불필요)
-- =============================================================================

ALTER TABLE formula_participants
    ADD COLUMN total_buy_amount NUMERIC(18,2)
        GENERATED ALWAYS AS (quantity * buy_unit_price) STORED,
    ADD COLUMN total_sell_amount NUMERIC(18,2)
        GENERATED ALWAYS AS (quantity * sell_unit_price) STORED;

-- =============================================================================
-- 3. formula_participants: sequence_order CHECK + 시작점/종료점 Partial Unique
-- =============================================================================

ALTER TABLE formula_participants
    ADD CONSTRAINT chk_sequence_order_positive CHECK (sequence_order > 0);

CREATE UNIQUE INDEX uq_fp_one_start_point
    ON formula_participants(formula_id) WHERE is_start_point = TRUE;

CREATE UNIQUE INDEX uq_fp_one_end_point
    ON formula_participants(formula_id) WHERE is_end_point = TRUE;

-- =============================================================================
-- 4. formula_logistics: 운송비 부담 주체 필수 CHECK
-- =============================================================================

ALTER TABLE formula_logistics
    ADD CONSTRAINT chk_logistics_cost_bearer CHECK (
        total_logistics_cost = 0 OR cost_bearer_company_id IS NOT NULL
    );

-- =============================================================================
-- 5. formula_versions: 복합 FK 선행 제약 (snapshot 복합 FK가 참조할 대상)
-- =============================================================================

ALTER TABLE formula_versions
    ADD CONSTRAINT uq_fv_id_formula UNIQUE (id, formula_id);

-- =============================================================================
-- 6. 복합 FK 5개 (MATCH SIMPLE: NULL이면 검사 생략)
--    base.sql의 uq_fp_id_formula, uq_fps_id_formula, uq_fv_id_formula(위에서 추가)
--    를 참조 대상으로 사용
-- =============================================================================

-- schedule.participant_id → 동일 formula 소속 participant만 허용
ALTER TABLE formula_payment_schedules
    ADD CONSTRAINT fk_schedule_participant_formula
        FOREIGN KEY (participant_id, formula_id)
        REFERENCES formula_participants(id, formula_id)
        MATCH SIMPLE;

-- record.payment_schedule_id → 동일 formula 소속 schedule만 허용
ALTER TABLE formula_payment_records
    ADD CONSTRAINT fk_record_schedule_formula
        FOREIGN KEY (payment_schedule_id, formula_id)
        REFERENCES formula_payment_schedules(id, formula_id)
        MATCH SIMPLE;

-- record.participant_id → 동일 formula 소속 participant만 허용
ALTER TABLE formula_payment_records
    ADD CONSTRAINT fk_record_participant_formula
        FOREIGN KEY (participant_id, formula_id)
        REFERENCES formula_participants(id, formula_id)
        MATCH SIMPLE;

-- formula_shares.participant_id → 동일 formula 소속 participant만 허용
ALTER TABLE formula_shares
    ADD CONSTRAINT fk_share_participant_formula
        FOREIGN KEY (participant_id, formula_id)
        REFERENCES formula_participants(id, formula_id)
        MATCH SIMPLE;

-- formula_calculation_snapshots.formula_version_id → 동일 formula 소속 version만 허용
ALTER TABLE formula_calculation_snapshots
    ADD CONSTRAINT fk_snapshot_version_formula
        FOREIGN KEY (formula_version_id, formula_id)
        REFERENCES formula_versions(id, formula_id)
        MATCH SIMPLE;

-- formula_invoices.issuer_participant_id / receiver_participant_id
--   → 동일 formula 소속 participant만 허용
ALTER TABLE formula_invoices
    ADD CONSTRAINT fk_invoice_issuer_participant_formula
        FOREIGN KEY (issuer_participant_id, formula_id)
        REFERENCES formula_participants(id, formula_id)
        MATCH SIMPLE,
    ADD CONSTRAINT fk_invoice_receiver_participant_formula
        FOREIGN KEY (receiver_participant_id, formula_id)
        REFERENCES formula_participants(id, formula_id)
        MATCH SIMPLE;

-- =============================================================================
-- 7. 트리거: Payment Schedule ↔ Record 방향 일치
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

CREATE TRIGGER trg_check_record_direction
    BEFORE INSERT OR UPDATE ON formula_payment_records
    FOR EACH ROW
    EXECUTE FUNCTION check_record_direction_matches_schedule();

-- =============================================================================
-- 8. 트리거: Invoice Participant ↔ Company 일치
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

CREATE TRIGGER trg_check_invoice_participant_company
    BEFORE INSERT OR UPDATE ON formula_invoices
    FOR EACH ROW
    EXECUTE FUNCTION check_invoice_participant_company_match();

-- =============================================================================
-- 9. formula_invoices: invoice_amount → external_invoice_amount
--    + GENERATED total_amount 추가 + amount_verified 자동계산 트리거
-- =============================================================================

ALTER TABLE formula_invoices
    RENAME COLUMN invoice_amount TO external_invoice_amount;

ALTER TABLE formula_invoices
    ADD COLUMN total_amount NUMERIC(18,2)
        GENERATED ALWAYS AS (COALESCE(supply_amount, 0) + COALESCE(tax_amount, 0)) STORED;

COMMENT ON COLUMN formula_invoices.external_invoice_amount IS
'외부(거래처) 발행 계산서 원본 표시 금액. total_amount(GENERATED)와 비교하여 amount_verified 자동 계산.';

CREATE OR REPLACE FUNCTION sync_invoice_amount_verified()
RETURNS TRIGGER AS $$
DECLARE
    v_total NUMERIC(18,2);
BEGIN
    -- GENERATED 컬럼은 BEFORE 트리거 시점에 미확정이므로 동일 수식 재계산
    v_total := COALESCE(NEW.supply_amount, 0) + COALESCE(NEW.tax_amount, 0);
    IF NEW.external_invoice_amount IS NOT NULL THEN
        NEW.amount_verified := (NEW.external_invoice_amount = v_total);
    ELSE
        NEW.amount_verified := FALSE;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_invoice_amount_verified
    BEFORE INSERT OR UPDATE ON formula_invoices
    FOR EACH ROW
    EXECUTE FUNCTION sync_invoice_amount_verified();

COMMENT ON FUNCTION sync_invoice_amount_verified() IS
'amount_verified만 자동 계산. invoice_status(AMOUNT_MATCHED/MISMATCHED) 전환은
API 레이어가 amount_verified를 참고해 결정 (REVISION_REQUIRED/CANCELED 등 실무자 지정 상태 보호).';

-- =============================================================================
-- 10. Partial Index 보강 (KPI/검색용)
-- =============================================================================

CREATE INDEX idx_formulas_unclosed
    ON formulas(is_closed, trade_status) WHERE NOT is_closed;

CREATE INDEX idx_fpr_kpi
    ON formula_payment_records(formula_id, direction, actual_amount)
    WHERE status = 'COMPLETED' AND NOT is_canceled;

CREATE INDEX idx_fpr_is_canceled ON formula_payment_records(formula_id, is_canceled);
CREATE INDEX idx_fpr_account_no  ON formula_payment_records(account_no) WHERE account_no IS NOT NULL;

CREATE INDEX idx_fl_departure   ON formula_logistics(departure_company_id)   WHERE departure_company_id   IS NOT NULL;
CREATE INDEX idx_fl_arrival     ON formula_logistics(arrival_company_id)     WHERE arrival_company_id     IS NOT NULL;
CREATE INDEX idx_fl_cost_bearer ON formula_logistics(cost_bearer_company_id) WHERE cost_bearer_company_id IS NOT NULL;

CREATE INDEX idx_fi_status               ON formula_invoices(status);
CREATE INDEX idx_fi_issuer_participant   ON formula_invoices(issuer_participant_id)   WHERE issuer_participant_id   IS NOT NULL;
CREATE INDEX idx_fi_receiver_participant ON formula_invoices(receiver_participant_id) WHERE receiver_participant_id IS NOT NULL;

CREATE INDEX idx_fv_created_at  ON formula_versions(formula_id, created_at DESC);
CREATE INDEX idx_fcs_created_at ON formula_calculation_snapshots(formula_id, created_at DESC);
CREATE INDEX idx_fsl_status_target ON formula_status_logs(formula_id, status_target);
CREATE INDEX idx_fsl_created_at    ON formula_status_logs(formula_id, created_at DESC);

-- =============================================================================
-- 11. View 6개
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
