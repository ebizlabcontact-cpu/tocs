-- =============================================================================
-- TOCS PostgreSQL Schema v1.5
-- Source of Truth: 이 파일이 DB 구조의 최종 기준
-- Review Round 5 반영: 2026-06-18
--
-- 변경사항 v1.4 → v1.5:
--   [B-1] formulas.payment_status → cash_in_status + cash_out_status 분리
--   [B-1] status_target ENUM: PAYMENT_STATUS → CASH_IN_STATUS + CASH_OUT_STATUS
--   [B-1] chk_closed_requires_all_completed: cash_in + cash_out 분리 반영
--   [B-2] formula_payment_schedules: participant 복합 FK 추가
--   [B-3] formula_invoices: issuer/receiver participant 복합 FK 추가
--   [B-4] PostgreSQL = Source of Truth 확정. Generated Column 유지.
--   [B-5] formula_logistics: chk_logistics_cost_bearer CHECK 추가
--   [B-6] 미매칭 입출금 KPI 정책 확정 (주석)
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE trade_type AS ENUM ('DOMESTIC', 'IMPORT', 'EXPORT', 'MIXED');

CREATE TYPE role_group AS ENUM ('SUPPLIER', 'BUYER', 'CARRIER', 'FINANCIAL', 'OTHER');

CREATE TYPE nature_group AS ENUM (
    'MANUFACTURER', 'DISTRIBUTOR', 'LOGISTICS', 'FINANCIAL_INSTITUTION', 'OTHER'
);

CREATE TYPE payment_group AS ENUM (
    'PREPAYMENT', 'CREDIT', 'POST_SETTLEMENT', 'INSTALLMENT', 'PARTIAL', 'OTHER'
);

CREATE TYPE payment_direction AS ENUM ('IN', 'OUT');

CREATE TYPE payment_status AS ENUM (
    'PENDING', 'PARTIAL', 'COMPLETED', 'CANCELED'
);

CREATE TYPE logistics_cost_type AS ENUM (
    'INCLUDED_IN_BUY_PRICE', 'INCLUDED_IN_SELL_PRICE', 'SEPARATE_COST'
);

CREATE TYPE invoice_status AS ENUM (
    'NOT_ISSUED', 'ISSUED', 'RECEIVED',
    'AMOUNT_MATCHED', 'AMOUNT_MISMATCHED', 'CANCELED', 'REVISION_REQUIRED'
);

CREATE TYPE trade_status AS ENUM (
    'DRAFT', 'IN_PROGRESS', 'COMPLETED', 'CANCELED'
);

-- [B-1] PAYMENT_STATUS → CASH_IN_STATUS + CASH_OUT_STATUS 분리
CREATE TYPE status_target AS ENUM (
    'TRADE_STATUS',
    'DELIVERY_STATUS',
    'CASH_IN_STATUS',    -- 입금 상태 (v1.4의 PAYMENT_STATUS에서 분리)
    'CASH_OUT_STATUS',   -- 출금 상태 (신규)
    'INVOICE_STATUS',
    'LOGISTICS_STATUS'
);

-- ============================================================
-- Sequence + 채번 함수
-- ============================================================

CREATE SEQUENCE formula_seq START 1 INCREMENT 1 NO CYCLE;

CREATE OR REPLACE FUNCTION generate_formula_no()
RETURNS VARCHAR AS $$
DECLARE
    v_seq BIGINT;
    v_ym  VARCHAR(4);
BEGIN
    v_seq := NEXTVAL('formula_seq');
    v_ym  := TO_CHAR(NOW(), 'YYMM');
    RETURN 'FM-' || v_ym || '-' || LPAD(v_seq::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 1. companies
-- ============================================================
CREATE TABLE companies (
    id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    company_name        VARCHAR(200) NOT NULL,
    business_reg_no     VARCHAR(20)  UNIQUE,
    representative_name VARCHAR(100),
    main_phone          VARCHAR(30),
    hq_address          TEXT,
    is_active           BOOLEAN      NOT NULL DEFAULT TRUE,
    memo                TEXT,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 2. company_contacts
-- ============================================================
CREATE TABLE company_contacts (
    id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id      UUID         NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    contact_name    VARCHAR(100) NOT NULL,
    title           VARCHAR(100),
    phone           VARCHAR(30),
    email           VARCHAR(200),
    branch_address  TEXT,
    is_primary      BOOLEAN      NOT NULL DEFAULT FALSE,
    is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
    memo            TEXT,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 3. items
-- ============================================================
CREATE TABLE items (
    id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    item_code       VARCHAR(100) UNIQUE,
    item_name       VARCHAR(300) NOT NULL,
    default_unit    VARCHAR(50),
    category        VARCHAR(100),
    is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
    memo            TEXT,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 4. formulas [핵심 원장]
-- ============================================================
CREATE TABLE formulas (
    id                          UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
    formula_no                  VARCHAR(20)    NOT NULL UNIQUE DEFAULT generate_formula_no(),
    trade_type                  trade_type     NOT NULL,
    item_id                     UUID           NOT NULL REFERENCES items(id),
    unit                        VARCHAR(50),
    quantity                    NUMERIC(18,4)  NOT NULL,

    base_currency               VARCHAR(10)    NOT NULL DEFAULT 'KRW',
    foreign_currency            VARCHAR(10),
    departure_country           VARCHAR(100),
    arrival_country             VARCHAR(100),
    contract_exchange_rate      NUMERIC(18,6),
    adjusted_exchange_rate      NUMERIC(18,6),
    exchange_rate_change_reason TEXT,

    content                     TEXT,
    note                        TEXT,

    -- 상태 (수동 처리. 자동 완료 금지)
    trade_status                trade_status   NOT NULL DEFAULT 'DRAFT',
    delivery_status             trade_status   NOT NULL DEFAULT 'DRAFT',

    -- [B-1] payment_status 분리: 입금상태 / 출금상태 독립 관리
    cash_in_status              payment_status NOT NULL DEFAULT 'PENDING',
    cash_out_status             payment_status NOT NULL DEFAULT 'PENDING',

    invoice_status              invoice_status NOT NULL DEFAULT 'NOT_ISSUED',
    logistics_status            trade_status   NOT NULL DEFAULT 'DRAFT',

    is_closed                   BOOLEAN        NOT NULL DEFAULT FALSE,
    closed_at                   TIMESTAMPTZ,

    created_by                  VARCHAR(200),
    created_at                  TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ    NOT NULL DEFAULT NOW(),

    -- [B-1] 종결 조건: cash_in + cash_out 모두 완료 필요
    CONSTRAINT chk_closed_requires_all_completed CHECK (
        NOT is_closed OR (
            trade_status     = 'COMPLETED' AND
            delivery_status  = 'COMPLETED' AND
            cash_in_status   = 'COMPLETED' AND
            cash_out_status  = 'COMPLETED' AND
            invoice_status   = 'AMOUNT_MATCHED' AND
            logistics_status = 'COMPLETED'
        )
    ),
    CONSTRAINT chk_closed_at_consistency CHECK (
        (is_closed = FALSE AND closed_at IS NULL) OR
        (is_closed = TRUE  AND closed_at IS NOT NULL)
    ),
    CONSTRAINT chk_domestic_no_exchange CHECK (
        trade_type != 'DOMESTIC' OR (
            foreign_currency IS NULL AND
            contract_exchange_rate IS NULL
        )
    )
);

COMMENT ON TABLE formulas IS '
Formula First Architecture 핵심 원장.
formula_no: FM-YYMM-NNNNN 형식.
[v1.5] payment_status → cash_in_status + cash_out_status 분리.
  cash_in_status:  입금 상태 독립 관리
  cash_out_status: 출금 상태 독립 관리
  예) 입금완료(COMPLETED) + 출금미완료(PENDING) 동시 표현 가능.
상태변경 시: formula_status_logs + audit_logs 동시 INSERT (트랜잭션 필수).
Source of Truth: PostgreSQL Schema (이 파일).
';

-- ============================================================
-- 5. formula_participants
-- ============================================================
CREATE TABLE formula_participants (
    id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    formula_id          UUID          NOT NULL REFERENCES formulas(id) ON DELETE CASCADE,
    company_id          UUID          NOT NULL REFERENCES companies(id),
    sequence_order      SMALLINT      NOT NULL,

    role_group          role_group    NOT NULL,
    nature_group        nature_group,
    payment_group       payment_group,

    buy_unit_price      NUMERIC(18,4) NOT NULL DEFAULT 0,
    sell_unit_price     NUMERIC(18,4) NOT NULL DEFAULT 0,
    quantity            NUMERIC(18,4),

    -- [B-4] Generated Column 유지: PostgreSQL Source of Truth
    -- Prisma는 이 컬럼을 선언하지 않음 → migration_supplement.sql에서 ADD COLUMN
    total_buy_amount    NUMERIC(18,2) GENERATED ALWAYS AS (
                            COALESCE(quantity, 0) * buy_unit_price
                        ) STORED,
    total_sell_amount   NUMERIC(18,2) GENERATED ALWAYS AS (
                            COALESCE(quantity, 0) * sell_unit_price
                        ) STORED,

    direct_cost_amount  NUMERIC(18,2) NOT NULL DEFAULT 0,

    is_start_point      BOOLEAN NOT NULL DEFAULT FALSE,
    is_end_point        BOOLEAN NOT NULL DEFAULT FALSE,
    memo                TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_fp_sequence  UNIQUE (formula_id, sequence_order),
    -- [B-2][B-3] 복합 FK 지원 기반
    CONSTRAINT uq_fp_id_formula UNIQUE (id, formula_id)
);

-- ============================================================
-- 6. formula_payment_schedules
-- ============================================================
CREATE TABLE formula_payment_schedules (
    id                      UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    formula_id              UUID          NOT NULL REFERENCES formulas(id) ON DELETE CASCADE,
    -- nullable: 참여자 미확정 상태에서 일정 먼저 등록 가능
    participant_id          UUID,
    direction               payment_direction NOT NULL,
    payment_type            payment_group     NOT NULL DEFAULT 'OTHER',
    counterparty_company_id UUID          REFERENCES companies(id),
    scheduled_amount        NUMERIC(18,2) NOT NULL,
    scheduled_date          DATE,
    status                  payment_status NOT NULL DEFAULT 'PENDING',
    memo                    TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_scheduled_amount_positive CHECK (scheduled_amount > 0),
    -- [B-4] 복합 FK 지원 기반
    CONSTRAINT uq_fps_id_formula UNIQUE (id, formula_id),
    -- [B-2] participant가 동일 formula 소속임을 보장
    CONSTRAINT fk_schedule_participant_formula
        FOREIGN KEY (participant_id, formula_id)
        REFERENCES formula_participants(id, formula_id)
        MATCH SIMPLE   -- NULL이면 검사 생략
);

COMMENT ON TABLE formula_payment_schedules IS '
[v1.5 B-2] participant 복합 FK 추가:
  fk_schedule_participant_formula: participant가 동일 formula 소속임을 DB 레벨 보장.
  MATCH SIMPLE: participant_id NULL이면 검사 생략.
';

-- ============================================================
-- 7. formula_payment_records
-- ============================================================
CREATE TABLE formula_payment_records (
    id                      UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    formula_id              UUID          NOT NULL REFERENCES formulas(id) ON DELETE CASCADE,
    -- nullable + 복합 FK: NULL이면 검사 생략, 값이 있으면 동일 formula 소속 보장
    payment_schedule_id     UUID,
    participant_id          UUID,
    direction               payment_direction NOT NULL,
    counterparty_company_id UUID          REFERENCES companies(id),

    actual_amount           NUMERIC(18,2) NOT NULL,
    actual_date             DATE          NOT NULL,

    bank_name               VARCHAR(100),
    account_name            VARCHAR(100),
    account_no              VARCHAR(50),
    bank_account_memo       VARCHAR(200),

    confirmed_by            VARCHAR(200),
    confirmed_at            TIMESTAMPTZ,
    status                  payment_status NOT NULL DEFAULT 'PENDING',

    is_canceled             BOOLEAN NOT NULL DEFAULT FALSE,
    canceled_at             TIMESTAMPTZ,
    cancel_reason           TEXT,

    memo                    TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_actual_amount_positive CHECK (actual_amount > 0),
    CONSTRAINT chk_cancel_consistency CHECK (
        NOT is_canceled OR canceled_at IS NOT NULL
    ),
    CONSTRAINT chk_confirmed_consistency CHECK (
        status != 'COMPLETED' OR confirmed_at IS NOT NULL
    ),
    -- 복합 FK: 교차 formula 오염 방지
    CONSTRAINT fk_record_schedule_formula
        FOREIGN KEY (payment_schedule_id, formula_id)
        REFERENCES formula_payment_schedules(id, formula_id)
        MATCH SIMPLE,
    CONSTRAINT fk_record_participant_formula
        FOREIGN KEY (participant_id, formula_id)
        REFERENCES formula_participants(id, formula_id)
        MATCH SIMPLE
);

COMMENT ON TABLE formula_payment_records IS '
[B-6] 미매칭 입출금 정책 (participant_id NULL):
  - formula 기준 KPI (v_formula_confirmed_kpi): formula_id 집계이므로 반영됨
  - 회사 기준 KPI (v_participant_confirmed_kpi): participant_id 기준이므로 누락
  - 누락분은 v_payment_unmatched로 추적. 실무자 매칭 후 자동 반영.
  → 이는 버그가 아닌 의도된 정책.
';

-- ============================================================
-- 8. formula_logistics
-- ============================================================
CREATE TABLE formula_logistics (
    id                      UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    formula_id              UUID          NOT NULL REFERENCES formulas(id) ON DELETE CASCADE,

    carrier_company_id      UUID          NOT NULL REFERENCES companies(id),
    departure_company_id    UUID          REFERENCES companies(id),
    arrival_company_id      UUID          REFERENCES companies(id),
    cost_bearer_company_id  UUID          REFERENCES companies(id),

    cost_type               logistics_cost_type NOT NULL DEFAULT 'SEPARATE_COST',
    departure_location      TEXT,
    arrival_location        TEXT,
    item_description        TEXT,
    transport_quantity      NUMERIC(18,4),
    vehicle_count           SMALLINT,
    total_logistics_cost    NUMERIC(18,2) NOT NULL DEFAULT 0,
    scheduled_date          DATE,
    memo                    TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- [B-5] 운송비 존재 시 부담 주체 필수
    CONSTRAINT chk_logistics_cost_bearer CHECK (
        total_logistics_cost = 0
        OR cost_bearer_company_id IS NOT NULL
    )
);

COMMENT ON TABLE formula_logistics IS '
[v1.5 B-5] chk_logistics_cost_bearer:
  total_logistics_cost > 0 이면 cost_bearer_company_id NOT NULL 강제.
  운송비가 있는데 부담 주체가 없는 데이터 방지.
';

-- ============================================================
-- 9. formula_logistics_vehicles
-- ============================================================
CREATE TABLE formula_logistics_vehicles (
    id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    logistics_id        UUID          NOT NULL REFERENCES formula_logistics(id) ON DELETE CASCADE,
    vehicle_no          VARCHAR(50),
    driver_name         VARCHAR(100),
    driver_phone        VARCHAR(30),
    vehicle_cost        NUMERIC(18,2),
    transport_status    trade_status   NOT NULL DEFAULT 'DRAFT',
    settlement_status   payment_status NOT NULL DEFAULT 'PENDING',
    memo                TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 10. formula_invoices
-- ============================================================
CREATE TABLE formula_invoices (
    id                      UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    formula_id              UUID          NOT NULL REFERENCES formulas(id) ON DELETE CASCADE,

    issuer_company_id       UUID          NOT NULL REFERENCES companies(id),
    receiver_company_id     UUID          NOT NULL REFERENCES companies(id),

    -- nullable: 역할 명확화 목적. 입력 강제는 API 레이어.
    issuer_participant_id   UUID,
    receiver_participant_id UUID,

    sequence_order          SMALLINT,
    invoice_no              VARCHAR(100),
    invoice_date            DATE,
    invoice_amount          NUMERIC(18,2),
    supply_amount           NUMERIC(18,2),
    tax_amount              NUMERIC(18,2),
    -- [B-4] Generated Column 유지
    total_amount            NUMERIC(18,2) GENERATED ALWAYS AS (
                                COALESCE(supply_amount, 0) + COALESCE(tax_amount, 0)
                            ) STORED,

    status                  invoice_status NOT NULL DEFAULT 'NOT_ISSUED',
    amount_verified         BOOLEAN        NOT NULL DEFAULT FALSE,
    memo                    TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_issuer_receiver_different CHECK (issuer_company_id != receiver_company_id),

    -- [B-3] participant가 동일 formula 소속임을 보장
    CONSTRAINT fk_invoice_issuer_participant_formula
        FOREIGN KEY (issuer_participant_id, formula_id)
        REFERENCES formula_participants(id, formula_id)
        MATCH SIMPLE,
    CONSTRAINT fk_invoice_receiver_participant_formula
        FOREIGN KEY (receiver_participant_id, formula_id)
        REFERENCES formula_participants(id, formula_id)
        MATCH SIMPLE
);

COMMENT ON TABLE formula_invoices IS '
[v1.5 B-3] participant 복합 FK 추가:
  issuer/receiver participant가 동일 formula 소속임을 DB 레벨 보장.
  MATCH SIMPLE: NULL이면 검사 생략.
';

-- ============================================================
-- 11. formula_shares
-- ============================================================
CREATE TABLE formula_shares (
    id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    formula_id          UUID          NOT NULL REFERENCES formulas(id) ON DELETE CASCADE,
    participant_id      UUID          REFERENCES formula_participants(id),
    target_company_id   UUID          REFERENCES companies(id),
    share_basis         VARCHAR(50)   NOT NULL DEFAULT 'DIRECT',
    share_method        VARCHAR(50)   NOT NULL DEFAULT 'DIRECT_INPUT',
    share_rate          NUMERIC(8,4),
    share_amount        NUMERIC(18,2) NOT NULL DEFAULT 0,
    memo                TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 12. formula_versions
-- ============================================================
CREATE TABLE formula_versions (
    id              UUID     PRIMARY KEY DEFAULT gen_random_uuid(),
    formula_id      UUID     NOT NULL REFERENCES formulas(id) ON DELETE CASCADE,
    version_no      SMALLINT NOT NULL,
    changed_by      VARCHAR(200),
    change_reason   TEXT,
    snapshot        JSONB    NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (formula_id, version_no)
);

-- ============================================================
-- 13. formula_calculation_snapshots
-- ============================================================
CREATE TABLE formula_calculation_snapshots (
    id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    formula_id          UUID          NOT NULL REFERENCES formulas(id) ON DELETE CASCADE,
    formula_version_id  UUID          REFERENCES formula_versions(id),
    quantity            NUMERIC(18,4) NOT NULL,
    total_buy_amount    NUMERIC(18,2) NOT NULL,
    total_sell_amount   NUMERIC(18,2) NOT NULL,
    total_cost          NUMERIC(18,2) NOT NULL DEFAULT 0,
    total_share         NUMERIC(18,2) NOT NULL DEFAULT 0,
    net_profit          NUMERIC(18,2) NOT NULL,
    profit_rate         NUMERIC(8,4),
    exchange_rate_used  NUMERIC(18,6),
    snapshot_data       JSONB         NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 14. formula_status_logs
-- ============================================================
CREATE TABLE formula_status_logs (
    id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    formula_id      UUID          NOT NULL REFERENCES formulas(id) ON DELETE CASCADE,
    status_target   status_target NOT NULL,
    prev_status     VARCHAR(100),
    new_status      VARCHAR(100)  NOT NULL,
    changed_by      VARCHAR(200),
    change_reason   TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE formula_status_logs IS '
[v1.5] status_target: CASH_IN_STATUS / CASH_OUT_STATUS (분리)
상태변경 시 formula_status_logs + audit_logs 동시 INSERT (트랜잭션 필수).
';

-- ============================================================
-- 15. audit_logs
-- ============================================================
CREATE TABLE audit_logs (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name  VARCHAR(100) NOT NULL,
    record_id   UUID,
    action      VARCHAR(20)  NOT NULL,
    changed_by  VARCHAR(200),
    old_data    JSONB,
    new_data    JSONB,
    ip_address  INET,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- INDEXES
-- =============================================================================

CREATE INDEX idx_companies_reg_no   ON companies(business_reg_no) WHERE business_reg_no IS NOT NULL;
CREATE INDEX idx_companies_active   ON companies(is_active);
CREATE INDEX idx_cc_company_id      ON company_contacts(company_id);
CREATE INDEX idx_cc_primary         ON company_contacts(company_id, is_primary);
CREATE INDEX idx_items_active       ON items(is_active);

CREATE INDEX idx_formulas_item_id       ON formulas(item_id);
CREATE INDEX idx_formulas_trade_type    ON formulas(trade_type);
CREATE INDEX idx_formulas_trade_status  ON formulas(trade_status);
CREATE INDEX idx_formulas_is_closed     ON formulas(is_closed);
CREATE INDEX idx_formulas_created_at    ON formulas(created_at DESC);
CREATE INDEX idx_formulas_formula_no    ON formulas(formula_no);
-- [B-1] 분리된 상태 인덱스
CREATE INDEX idx_formulas_cash_in_status  ON formulas(cash_in_status);
CREATE INDEX idx_formulas_cash_out_status ON formulas(cash_out_status);
CREATE INDEX idx_formulas_unclosed        ON formulas(is_closed, trade_status) WHERE NOT is_closed;

CREATE INDEX idx_fp_formula_id  ON formula_participants(formula_id);
CREATE INDEX idx_fp_company_id  ON formula_participants(company_id);
CREATE INDEX idx_fp_sequence    ON formula_participants(formula_id, sequence_order);

CREATE INDEX idx_fps_formula_id     ON formula_payment_schedules(formula_id);
CREATE INDEX idx_fps_direction      ON formula_payment_schedules(formula_id, direction);
CREATE INDEX idx_fps_counterparty   ON formula_payment_schedules(counterparty_company_id);
CREATE INDEX idx_fps_status         ON formula_payment_schedules(status);
CREATE INDEX idx_fps_scheduled_date ON formula_payment_schedules(scheduled_date);

CREATE INDEX idx_fpr_formula_id  ON formula_payment_records(formula_id);
CREATE INDEX idx_fpr_schedule_id ON formula_payment_records(payment_schedule_id);
CREATE INDEX idx_fpr_direction   ON formula_payment_records(formula_id, direction);
CREATE INDEX idx_fpr_is_canceled ON formula_payment_records(formula_id, is_canceled);
CREATE INDEX idx_fpr_kpi         ON formula_payment_records(formula_id, direction, actual_amount)
    WHERE status = 'COMPLETED' AND NOT is_canceled;
CREATE INDEX idx_fpr_actual_date ON formula_payment_records(actual_date DESC);
CREATE INDEX idx_fpr_account_no  ON formula_payment_records(account_no) WHERE account_no IS NOT NULL;

CREATE INDEX idx_fl_formula_id   ON formula_logistics(formula_id);
CREATE INDEX idx_fl_carrier      ON formula_logistics(carrier_company_id);
CREATE INDEX idx_fl_departure    ON formula_logistics(departure_company_id)  WHERE departure_company_id  IS NOT NULL;
CREATE INDEX idx_fl_arrival      ON formula_logistics(arrival_company_id)    WHERE arrival_company_id    IS NOT NULL;
CREATE INDEX idx_fl_cost_bearer  ON formula_logistics(cost_bearer_company_id) WHERE cost_bearer_company_id IS NOT NULL;

CREATE INDEX idx_flv_logistics_id     ON formula_logistics_vehicles(logistics_id);
CREATE INDEX idx_flv_transport_status ON formula_logistics_vehicles(transport_status);
CREATE INDEX idx_flv_settlement       ON formula_logistics_vehicles(settlement_status);

CREATE INDEX idx_fi_formula_id           ON formula_invoices(formula_id);
CREATE INDEX idx_fi_issuer               ON formula_invoices(issuer_company_id);
CREATE INDEX idx_fi_receiver             ON formula_invoices(receiver_company_id);
CREATE INDEX idx_fi_status               ON formula_invoices(status);
CREATE INDEX idx_fi_issuer_participant   ON formula_invoices(issuer_participant_id)   WHERE issuer_participant_id   IS NOT NULL;
CREATE INDEX idx_fi_receiver_participant ON formula_invoices(receiver_participant_id) WHERE receiver_participant_id IS NOT NULL;

CREATE INDEX idx_fs_formula_id    ON formula_shares(formula_id);
CREATE INDEX idx_fs_participant   ON formula_shares(participant_id);
CREATE INDEX idx_fs_target        ON formula_shares(target_company_id);

CREATE INDEX idx_fv_formula_id   ON formula_versions(formula_id);
CREATE INDEX idx_fv_created_at   ON formula_versions(formula_id, created_at DESC);

CREATE INDEX idx_fcs_formula_id  ON formula_calculation_snapshots(formula_id);
CREATE INDEX idx_fcs_created_at  ON formula_calculation_snapshots(formula_id, created_at DESC);

CREATE INDEX idx_fsl_formula_id    ON formula_status_logs(formula_id);
CREATE INDEX idx_fsl_target        ON formula_status_logs(formula_id, status_target);
CREATE INDEX idx_fsl_created_at    ON formula_status_logs(formula_id, created_at DESC);

CREATE INDEX idx_al_table_name ON audit_logs(table_name);
CREATE INDEX idx_al_record_id  ON audit_logs(record_id);
CREATE INDEX idx_al_action     ON audit_logs(action);
CREATE INDEX idx_al_created_at ON audit_logs(created_at DESC);

-- =============================================================================
-- VIEWS
-- =============================================================================

-- KPI View (Formula 전체 기준)
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
    f.id           AS formula_id,
    f.formula_no,
    -- [B-1] cash_in / cash_out 상태 분리 반영
    f.cash_in_status,
    f.cash_out_status,
    COALESCE(c.confirmed_in,  0)                                     AS confirmed_revenue,
    COALESCE(c.confirmed_out, 0)                                     AS confirmed_payment,
    COALESCE(s.scheduled_in,  0)                                     AS scheduled_revenue,
    COALESCE(s.scheduled_out, 0)                                     AS scheduled_payment,
    COALESCE(s.scheduled_in,  0) - COALESCE(c.confirmed_in,  0)     AS receivable,
    COALESCE(s.scheduled_out, 0) - COALESCE(c.confirmed_out, 0)     AS payable,
    CASE WHEN COALESCE(s.scheduled_in,  0) = 0 THEN NULL
         ELSE ROUND(COALESCE(c.confirmed_in,  0) / s.scheduled_in  * 100, 2) END AS receive_rate,
    CASE WHEN COALESCE(s.scheduled_out, 0) = 0 THEN NULL
         ELSE ROUND(COALESCE(c.confirmed_out, 0) / s.scheduled_out * 100, 2) END AS payment_rate
FROM formulas f
LEFT JOIN confirmed c ON c.formula_id = f.id
LEFT JOIN scheduled s ON s.formula_id = f.id;

-- 회사 기준 KPI View
CREATE OR REPLACE VIEW v_participant_confirmed_kpi AS
WITH
sched AS (
    SELECT formula_id, participant_id,
        SUM(scheduled_amount) FILTER (WHERE direction = 'IN')  AS scheduled_in,
        SUM(scheduled_amount) FILTER (WHERE direction = 'OUT') AS scheduled_out
    FROM formula_payment_schedules
    GROUP BY formula_id, participant_id
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
    fp.id AS participant_id,
    fp.company_id, c.company_name,
    fp.role_group, fp.sequence_order,
    fp.total_buy_amount, fp.total_sell_amount,
    COALESCE(a.confirmed_in,  0)                                     AS confirmed_in,
    COALESCE(a.confirmed_out, 0)                                     AS confirmed_out,
    COALESCE(s.scheduled_in,  0)                                     AS scheduled_in,
    COALESCE(s.scheduled_out, 0)                                     AS scheduled_out,
    COALESCE(s.scheduled_in,  0) - COALESCE(a.confirmed_in,  0)     AS receivable,
    COALESCE(s.scheduled_out, 0) - COALESCE(a.confirmed_out, 0)     AS payable,
    COALESCE(a.confirmed_in,  0) - COALESCE(a.confirmed_out, 0)     AS confirmed_net_profit
FROM formula_participants fp
JOIN formulas  f ON f.id = fp.formula_id
JOIN companies c ON c.id = fp.company_id
LEFT JOIN sched  s ON s.formula_id = fp.formula_id AND s.participant_id = fp.id
LEFT JOIN actual a ON a.formula_id = fp.formula_id AND a.participant_id = fp.id;

-- Profit Engine View
CREATE OR REPLACE VIEW v_formula_profit_engine AS
WITH profit_base AS (
    SELECT formula_id,
        SUM(actual_amount) FILTER (WHERE direction = 'IN')  AS confirmed_in,
        SUM(actual_amount) FILTER (WHERE direction = 'OUT') AS confirmed_out
    FROM formula_payment_records
    WHERE status = 'COMPLETED' AND NOT is_canceled
    GROUP BY formula_id
),
expected_base AS (
    SELECT DISTINCT ON (formula_id) formula_id,
        net_profit AS expected_net_profit, profit_rate AS expected_profit_rate,
        total_sell_amount, total_buy_amount, total_cost, total_share
    FROM formula_calculation_snapshots
    ORDER BY formula_id, created_at DESC
)
SELECT
    f.id AS formula_id, f.formula_no,
    COALESCE(p.confirmed_in,  0)                                 AS confirmed_revenue,
    COALESCE(p.confirmed_out, 0)                                 AS confirmed_cost_total,
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

-- Invoice Status View (LEFT JOIN: 0건 Formula = NOT_ISSUED)
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

-- 미매칭 입출금 추적 View
CREATE OR REPLACE VIEW v_payment_unmatched AS
SELECT
    r.id, r.formula_id, f.formula_no,
    r.direction, r.actual_amount, r.actual_date,
    r.bank_name, r.account_no, r.status, r.memo, r.created_at
FROM formula_payment_records r
JOIN formulas f ON f.id = r.formula_id
WHERE r.payment_schedule_id IS NULL AND NOT r.is_canceled;

-- 종결 가능 여부 View
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
