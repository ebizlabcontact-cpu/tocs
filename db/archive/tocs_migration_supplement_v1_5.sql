-- =============================================================================
-- TOCS Migration Supplement v1.5
-- prisma migrate dev 실행 후 이 파일을 반드시 실행할 것
-- Prisma가 처리하지 못하는 PostgreSQL 전용 요소 포함
-- =============================================================================

-- [필수] Extension
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- [필수] Sequence + 채번 함수
CREATE SEQUENCE IF NOT EXISTS formula_seq START 1 INCREMENT 1 NO CYCLE;

CREATE OR REPLACE FUNCTION generate_formula_no()
RETURNS VARCHAR AS $$
DECLARE v_seq BIGINT; v_ym VARCHAR(4);
BEGIN
    v_seq := NEXTVAL('formula_seq');
    v_ym  := TO_CHAR(NOW(), 'YYMM');
    RETURN 'FM-' || v_ym || '-' || LPAD(v_seq::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- CHECK Constraints
-- =============================================================================

-- formulas: 종결 조건 (cash_in + cash_out 분리 반영)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_closed_requires_all_completed') THEN
        ALTER TABLE formulas ADD CONSTRAINT chk_closed_requires_all_completed CHECK (
            NOT is_closed OR (
                trade_status     = 'COMPLETED' AND
                delivery_status  = 'COMPLETED' AND
                cash_in_status   = 'COMPLETED' AND
                cash_out_status  = 'COMPLETED' AND
                invoice_status   = 'AMOUNT_MATCHED' AND
                logistics_status = 'COMPLETED'
            )
        );
    END IF;
END $$;

-- formulas: closed_at 정합성
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_closed_at_consistency') THEN
        ALTER TABLE formulas ADD CONSTRAINT chk_closed_at_consistency CHECK (
            (is_closed = FALSE AND closed_at IS NULL) OR
            (is_closed = TRUE  AND closed_at IS NOT NULL)
        );
    END IF;
END $$;

-- formulas: 국내거래 환율 불필요
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_domestic_no_exchange') THEN
        ALTER TABLE formulas ADD CONSTRAINT chk_domestic_no_exchange CHECK (
            trade_type != 'DOMESTIC' OR (
                foreign_currency IS NULL AND contract_exchange_rate IS NULL
            )
        );
    END IF;
END $$;

-- formula_payment_schedules: 금액 양수
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_scheduled_amount_positive') THEN
        ALTER TABLE formula_payment_schedules
            ADD CONSTRAINT chk_scheduled_amount_positive CHECK (scheduled_amount > 0);
    END IF;
END $$;

-- formula_payment_records: 금액 양수
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_actual_amount_positive') THEN
        ALTER TABLE formula_payment_records
            ADD CONSTRAINT chk_actual_amount_positive CHECK (actual_amount > 0);
    END IF;
END $$;

-- formula_payment_records: 취소 일관성
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_cancel_consistency') THEN
        ALTER TABLE formula_payment_records
            ADD CONSTRAINT chk_cancel_consistency CHECK (
                NOT is_canceled OR canceled_at IS NOT NULL
            );
    END IF;
END $$;

-- formula_payment_records: 완료 일관성
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_confirmed_consistency') THEN
        ALTER TABLE formula_payment_records
            ADD CONSTRAINT chk_confirmed_consistency CHECK (
                status != 'COMPLETED' OR confirmed_at IS NOT NULL
            );
    END IF;
END $$;

-- formula_invoices: 발행인/수취인 다름
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_issuer_receiver_different') THEN
        ALTER TABLE formula_invoices
            ADD CONSTRAINT chk_issuer_receiver_different CHECK (
                issuer_company_id != receiver_company_id
            );
    END IF;
END $$;

-- [B-5] formula_logistics: 운송비 존재 시 부담 주체 필수
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_logistics_cost_bearer') THEN
        ALTER TABLE formula_logistics
            ADD CONSTRAINT chk_logistics_cost_bearer CHECK (
                total_logistics_cost = 0 OR cost_bearer_company_id IS NOT NULL
            );
    END IF;
END $$;

-- =============================================================================
-- GENERATED ALWAYS AS STORED 컬럼
-- =============================================================================

-- formula_participants
ALTER TABLE formula_participants
    ADD COLUMN IF NOT EXISTS total_buy_amount NUMERIC(18,2)
        GENERATED ALWAYS AS (COALESCE(quantity, 0) * buy_unit_price) STORED,
    ADD COLUMN IF NOT EXISTS total_sell_amount NUMERIC(18,2)
        GENERATED ALWAYS AS (COALESCE(quantity, 0) * sell_unit_price) STORED;

-- formula_invoices
ALTER TABLE formula_invoices
    ADD COLUMN IF NOT EXISTS total_amount NUMERIC(18,2)
        GENERATED ALWAYS AS (COALESCE(supply_amount, 0) + COALESCE(tax_amount, 0)) STORED;

-- =============================================================================
-- 복합 UNIQUE (복합 FK 기반)
-- =============================================================================

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_fp_id_formula') THEN
        ALTER TABLE formula_participants
            ADD CONSTRAINT uq_fp_id_formula UNIQUE (id, formula_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_fps_id_formula') THEN
        ALTER TABLE formula_payment_schedules
            ADD CONSTRAINT uq_fps_id_formula UNIQUE (id, formula_id);
    END IF;
END $$;

-- =============================================================================
-- 복합 FK (MATCH SIMPLE: NULL이면 검사 생략)
-- =============================================================================

-- [B-2] schedule → participant 복합 FK
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_schedule_participant_formula') THEN
        ALTER TABLE formula_payment_schedules
            ADD CONSTRAINT fk_schedule_participant_formula
                FOREIGN KEY (participant_id, formula_id)
                REFERENCES formula_participants(id, formula_id)
                MATCH SIMPLE;
    END IF;
END $$;

-- record → schedule 복합 FK
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_record_schedule_formula') THEN
        ALTER TABLE formula_payment_records
            ADD CONSTRAINT fk_record_schedule_formula
                FOREIGN KEY (payment_schedule_id, formula_id)
                REFERENCES formula_payment_schedules(id, formula_id)
                MATCH SIMPLE;
    END IF;
END $$;

-- record → participant 복합 FK
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_record_participant_formula') THEN
        ALTER TABLE formula_payment_records
            ADD CONSTRAINT fk_record_participant_formula
                FOREIGN KEY (participant_id, formula_id)
                REFERENCES formula_participants(id, formula_id)
                MATCH SIMPLE;
    END IF;
END $$;

-- [B-3] invoice → issuer participant 복합 FK
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_invoice_issuer_participant_formula') THEN
        ALTER TABLE formula_invoices
            ADD CONSTRAINT fk_invoice_issuer_participant_formula
                FOREIGN KEY (issuer_participant_id, formula_id)
                REFERENCES formula_participants(id, formula_id)
                MATCH SIMPLE;
    END IF;
END $$;

-- invoice → receiver participant 복합 FK
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_invoice_receiver_participant_formula') THEN
        ALTER TABLE formula_invoices
            ADD CONSTRAINT fk_invoice_receiver_participant_formula
                FOREIGN KEY (receiver_participant_id, formula_id)
                REFERENCES formula_participants(id, formula_id)
                MATCH SIMPLE;
    END IF;
END $$;

-- =============================================================================
-- Partial Indexes
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_formulas_unclosed
    ON formulas(is_closed, trade_status) WHERE NOT is_closed;
CREATE INDEX IF NOT EXISTS idx_fpr_kpi
    ON formula_payment_records(formula_id, direction, actual_amount)
    WHERE status = 'COMPLETED' AND NOT is_canceled;
CREATE INDEX IF NOT EXISTS idx_fpr_account_no
    ON formula_payment_records(account_no) WHERE account_no IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_fl_departure
    ON formula_logistics(departure_company_id)  WHERE departure_company_id  IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_fl_arrival
    ON formula_logistics(arrival_company_id)    WHERE arrival_company_id    IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_fl_cost_bearer
    ON formula_logistics(cost_bearer_company_id) WHERE cost_bearer_company_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_fi_issuer_participant
    ON formula_invoices(issuer_participant_id)   WHERE issuer_participant_id   IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_fi_receiver_participant
    ON formula_invoices(receiver_participant_id) WHERE receiver_participant_id IS NOT NULL;

-- =============================================================================
-- VIEWS
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
        WHEN COUNT(fi.id) FILTER (WHERE fi.status != 'CANCELED') = 0
            THEN 'NOT_ISSUED'
        WHEN COUNT(fi.id) FILTER (WHERE fi.status = 'REVISION_REQUIRED') > 0
            THEN 'REVISION_REQUIRED'
        WHEN COUNT(fi.id) FILTER (WHERE fi.status = 'AMOUNT_MISMATCHED') > 0
            THEN 'AMOUNT_MISMATCHED'
        WHEN COUNT(fi.id) FILTER (WHERE fi.status IN ('NOT_ISSUED','ISSUED','RECEIVED')) > 0
            THEN 'ISSUED'
        WHEN COUNT(fi.id) FILTER (WHERE fi.status != 'CANCELED')
           = COUNT(fi.id) FILTER (WHERE fi.status = 'AMOUNT_MATCHED')
           AND COUNT(fi.id) FILTER (WHERE fi.status != 'CANCELED') > 0
            THEN 'AMOUNT_MATCHED'
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
