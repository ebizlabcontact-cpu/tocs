-- =============================================================================
-- TOCS PostgreSQL Base Schema (Final)
-- =============================================================================
-- 이 파일은 "테이블 / ENUM 타입 / 기본 FK / Sequence / 채번 함수"까지만 포함한다.
--
-- 이 파일에 절대 포함하지 않는 것 (전부 supplement.sql에서 처리):
--   - View (v_formula_confirmed_kpi 등)
--   - Trigger / Trigger Function
--   - 복합 FK (MATCH SIMPLE 포함 — formula_participants 외 테이블 간 교차검증용)
--   - Partial Unique Index (uq_fp_one_start_point 등)
--   - GENERATED 컬럼 재생성 관련 모든 작업
--   - cash_in_status/cash_out_status 종결조건을 포함한 종결 CHECK
--     (base에는 컬럼만 존재. 종결 CHECK는 supplement에서 추가)
--
-- 실행 순서: 이 파일 → tocs_supplement.sql (반드시 이 순서로만)
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- ENUM 타입 (테이블보다 먼저 와야 함)
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

CREATE TYPE status_target AS ENUM (
    'TRADE_STATUS', 'DELIVERY_STATUS', 'CASH_IN_STATUS',
    'CASH_OUT_STATUS', 'INVOICE_STATUS', 'LOGISTICS_STATUS'
);

-- ============================================================
-- Sequence + 채번 함수
-- (함수는 DDL 객체이지만 formulas.formula_no DEFAULT가 즉시 필요로 하므로
--  base에 포함. View/Trigger와는 성격이 다름)
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
-- 4. formulas
-- [주의] 이 base에는 cash_in_status/cash_out_status "컬럼"만 존재한다.
--        이 두 상태를 포함한 종결 CHECK(chk_closed_requires_all_completed)는
--        supplement.sql에서 추가한다 (base에서는 추가하지 않음).
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

    trade_status                trade_status   NOT NULL DEFAULT 'DRAFT',
    delivery_status             trade_status   NOT NULL DEFAULT 'DRAFT',
    cash_in_status               payment_status NOT NULL DEFAULT 'PENDING',
    cash_out_status              payment_status NOT NULL DEFAULT 'PENDING',
    invoice_status               invoice_status NOT NULL DEFAULT 'NOT_ISSUED',
    logistics_status             trade_status   NOT NULL DEFAULT 'DRAFT',

    is_closed                   BOOLEAN        NOT NULL DEFAULT FALSE,
    closed_at                   TIMESTAMPTZ,

    created_by                  VARCHAR(200),
    created_at                  TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ    NOT NULL DEFAULT NOW(),

    -- base에 포함하는 CHECK는 "같은 컬럼 그룹 내 단순 정합성"만.
    -- (closed_at 일관성, 국내거래 환율 — 둘 다 상태 ENUM 6종 조합과 무관한 단순 규칙)
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
    -- chk_closed_requires_all_completed (cash_in/cash_out 포함 종결조건)
    -- → supplement.sql에서 ALTER TABLE ... ADD CONSTRAINT 로 추가
);

-- ============================================================
-- 5. formula_participants
-- [주의] GENERATED 컬럼(total_buy_amount, total_sell_amount)은
--        base에 넣지 않는다. supplement.sql에서 ADD COLUMN으로 생성.
--        sequence_order CHECK(>0), start/end point unique index도
--        supplement에서 처리.
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
    quantity            NUMERIC(18,4) NOT NULL,

    direct_cost_amount  NUMERIC(18,2) NOT NULL DEFAULT 0,

    is_start_point      BOOLEAN NOT NULL DEFAULT FALSE,
    is_end_point        BOOLEAN NOT NULL DEFAULT FALSE,
    memo                TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- 이 두 UNIQUE는 "기본 FK/정합성"에 해당하므로 base에 포함.
    -- (복합 FK 자체가 아니라, 복합 FK가 참조할 대상이 되는 선행 제약)
    CONSTRAINT uq_fp_sequence   UNIQUE (formula_id, sequence_order),
    CONSTRAINT uq_fp_id_formula UNIQUE (id, formula_id)
);

-- ============================================================
-- 6. formula_payment_schedules
-- [주의] participant 복합 FK(MATCH SIMPLE)는 supplement에서 추가.
--        여기서는 단순 FK만.
-- ============================================================
CREATE TABLE formula_payment_schedules (
    id                      UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    formula_id              UUID          NOT NULL REFERENCES formulas(id) ON DELETE CASCADE,
    participant_id          UUID          REFERENCES formula_participants(id),
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
    CONSTRAINT uq_fps_id_formula UNIQUE (id, formula_id)
);

-- ============================================================
-- 7. formula_payment_records
-- [주의] schedule/participant 복합 FK, direction 일치 트리거는 supplement.
-- ============================================================
CREATE TABLE formula_payment_records (
    id                      UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    formula_id              UUID          NOT NULL REFERENCES formulas(id) ON DELETE CASCADE,
    payment_schedule_id     UUID          REFERENCES formula_payment_schedules(id),
    participant_id          UUID          REFERENCES formula_participants(id),
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
    )
);

-- ============================================================
-- 8. formula_logistics
-- [주의] chk_logistics_cost_bearer CHECK는 supplement에서 추가.
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
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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
-- [주의] GENERATED 컬럼(total_amount)은 base에 넣지 않는다.
--        issuer/receiver participant 복합 FK, amount_verified 자동계산
--        트리거는 supplement.sql에서 처리.
--        invoice_amount는 base에서 그대로 둔다.
--        (→ supplement에서 external_invoice_amount로 RENAME)
-- ============================================================
CREATE TABLE formula_invoices (
    id                      UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    formula_id              UUID          NOT NULL REFERENCES formulas(id) ON DELETE CASCADE,

    issuer_company_id       UUID          NOT NULL REFERENCES companies(id),
    receiver_company_id     UUID          NOT NULL REFERENCES companies(id),

    issuer_participant_id   UUID          REFERENCES formula_participants(id),
    receiver_participant_id UUID          REFERENCES formula_participants(id),

    sequence_order          SMALLINT,
    invoice_no              VARCHAR(100),
    invoice_date            DATE,
    invoice_amount          NUMERIC(18,2),
    supply_amount           NUMERIC(18,2),
    tax_amount              NUMERIC(18,2),

    status                  invoice_status NOT NULL DEFAULT 'NOT_ISSUED',
    amount_verified         BOOLEAN        NOT NULL DEFAULT FALSE,
    memo                    TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_issuer_receiver_different CHECK (issuer_company_id != receiver_company_id)
);

-- ============================================================
-- 11. formula_shares
-- [주의] participant 복합 FK는 supplement에서 추가.
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
-- [주의] uq_fv_id_formula(복합 FK용 선행 제약)는 supplement에서 추가.
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
-- [주의] formula_version_id 복합 FK는 supplement에서 추가.
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

-- ============================================================
-- 기본 인덱스 (테이블당 FK/조회 기본 인덱스만. Partial Index는 supplement)
-- ============================================================

CREATE INDEX idx_companies_reg_no ON companies(business_reg_no) WHERE business_reg_no IS NOT NULL;
CREATE INDEX idx_companies_active ON companies(is_active);
CREATE INDEX idx_cc_company_id    ON company_contacts(company_id);
CREATE INDEX idx_items_active     ON items(is_active);

CREATE INDEX idx_formulas_item_id      ON formulas(item_id);
CREATE INDEX idx_formulas_trade_type   ON formulas(trade_type);
CREATE INDEX idx_formulas_trade_status ON formulas(trade_status);
CREATE INDEX idx_formulas_is_closed    ON formulas(is_closed);
CREATE INDEX idx_formulas_created_at   ON formulas(created_at DESC);
CREATE INDEX idx_formulas_cash_in      ON formulas(cash_in_status);
CREATE INDEX idx_formulas_cash_out     ON formulas(cash_out_status);

CREATE INDEX idx_fp_formula_id ON formula_participants(formula_id);
CREATE INDEX idx_fp_company_id ON formula_participants(company_id);

CREATE INDEX idx_fps_formula_id ON formula_payment_schedules(formula_id);
CREATE INDEX idx_fps_direction  ON formula_payment_schedules(formula_id, direction);

CREATE INDEX idx_fpr_formula_id  ON formula_payment_records(formula_id);
CREATE INDEX idx_fpr_schedule_id ON formula_payment_records(payment_schedule_id);
CREATE INDEX idx_fpr_direction   ON formula_payment_records(formula_id, direction);

CREATE INDEX idx_fl_formula_id ON formula_logistics(formula_id);
CREATE INDEX idx_fl_carrier    ON formula_logistics(carrier_company_id);

CREATE INDEX idx_fi_formula_id ON formula_invoices(formula_id);
CREATE INDEX idx_fi_issuer     ON formula_invoices(issuer_company_id);
CREATE INDEX idx_fi_receiver   ON formula_invoices(receiver_company_id);

CREATE INDEX idx_fs_formula_id ON formula_shares(formula_id);

CREATE INDEX idx_fv_formula_id ON formula_versions(formula_id);

CREATE INDEX idx_fcs_formula_id ON formula_calculation_snapshots(formula_id);

CREATE INDEX idx_fsl_formula_id ON formula_status_logs(formula_id);

CREATE INDEX idx_al_table_name ON audit_logs(table_name);
