# PRISMA_MODEL_DESIGN_v1.0

## 문서 목적

PostgreSQL Source of Truth 원칙(DECISION_LOG DL-017) 하에서 Prisma가
TOCS DB를 어떻게 모델링할지 설계한다. 이 문서는 설계 문서이며
`schema.prisma` 실제 파일을 생성하지 않는다.

**핵심 전제**: Prisma는 DB 구조를 정의하는 도구가 아니다. PostgreSQL
SQL 파일(`tocs_base_schema.sql` + `tocs_supplement.sql` +
`tocs_fix_amount_verified.sql`)이 DB의 유일한 Source of Truth이며,
Prisma는 그 결과물 위에서 동작하는 ORM 매핑 계층일 뿐이다. Prisma
Migrate는 사용하지 않는다(이미 `tocs_base_schema.sql` 등으로 스키마가
확정되어 있으므로, Prisma가 스키마를 다시 정의하면 두 개의 Source of
Truth가 생겨 충돌한다).

---

## 1. Prisma가 표현 가능한 것 / 불가능한 것 — 전체 인벤토리 기준 분류

아래 표는 추측이 아니라 `tocs_base_schema.sql`/`tocs_supplement.sql`을
직접 검색하여 확인한 전체 객체 목록이다.

### 1.1 Prisma가 표현 가능한 것

| 객체 종류 | 개수 | Prisma 표현 방법 |
|---|---|---|
| 테이블 (`model`) | 15개 | `model` 블록 (2장 참조) |
| 일반 컬럼 | 전체 | `model` 필드 |
| ENUM 타입 | 10개 | `enum` 블록 |
| 단순 FK (단일 컬럼) | 다수 | `@relation` |
| 단순 UNIQUE | 다수 | `@unique` |
| 복합 UNIQUE (`uq_fp_id_formula` 등 4건) | 4개 | `@@unique([...])` |
| 일반 Index | 다수 | `@@index([...])` |
| Sequence 존재 자체(채번값 자동 생성에 의존) | 1개 (`formula_seq`) | `@default(dbgenerated(...))`로 결과만 수신(2.3절) |

### 1.2 Prisma가 표현 불가능한 것 — SQL 파일이 전담

| 객체 종류 | 실제 개수 (검증됨) | 목록 |
|---|---|---|
| **Trigger** | 3개 | `trg_check_record_direction`, `trg_check_invoice_participant_company`, `trg_sync_invoice_amount_verified` |
| **View** | 6개 | `v_formula_confirmed_kpi`, `v_participant_confirmed_kpi`, `v_formula_profit_engine`, `v_formula_invoice_status`, `v_payment_unmatched`, `v_formula_closeable` |
| **GENERATED 컬럼** | 3개 | `formula_participants.total_buy_amount`, `formula_participants.total_sell_amount`, `formula_invoices.total_amount` |
| **복합 FK (MATCH SIMPLE)** | 7개 | `fk_schedule_participant_formula`, `fk_record_schedule_formula`, `fk_record_participant_formula`, `fk_share_participant_formula`, `fk_snapshot_version_formula`, `fk_invoice_issuer_participant_formula`, `fk_invoice_receiver_participant_formula` |
| **Partial Index (조건부)** | 8개 | `uq_fp_one_start_point`, `uq_fp_one_end_point`(Partial Unique) + `idx_companies_reg_no`, `idx_fpr_account_no`, `idx_fl_departure`, `idx_fl_arrival`, `idx_fl_cost_bearer`, `idx_fi_issuer_participant`, `idx_fi_receiver_participant`(일반 Partial) |
| **CHECK Constraint** | 10개 | `chk_closed_at_consistency`, `chk_domestic_no_exchange`, `chk_scheduled_amount_positive`, `chk_actual_amount_positive`, `chk_cancel_consistency`, `chk_confirmed_consistency`, `chk_issuer_receiver_different`, `chk_closed_requires_all_completed`, `chk_sequence_order_positive`, `chk_logistics_cost_bearer` |
| **Sequence + 채번 함수** | 1개 | `formula_seq`, `generate_formula_no()` |

이 7개 카테고리는 **Prisma schema 문법 자체가 표현할 방법이 없다.**
(Prisma는 trigger, view, generated column, 복합FK의 MATCH SIMPLE 옵션,
조건부 partial index, plpgsql 함수 정의를 스키마 언어로 지원하지 않음.)
이들은 전부 `tocs_base_schema.sql`/`tocs_supplement.sql`에만 정의되어
있으며, Prisma 쪽에는 "이런 게 있다"는 사실만 주석으로 남긴다.

---

## 2. Model 구조 설계 (15개 테이블)

### 2.1 Model ↔ 테이블 매핑 원칙

모든 `model`은 `@@map("table_name")`으로 실제 PostgreSQL 테이블명에
매핑한다. Prisma가 테이블을 새로 만드는 것이 아니라, 이미 존재하는
테이블에 이름을 맞춰 들어가는 것임을 명확히 하기 위함이다.

```
Company              @@map("companies")
CompanyContact       @@map("company_contacts")
Item                 @@map("items")
Formula              @@map("formulas")
FormulaParticipant   @@map("formula_participants")
PaymentSchedule      @@map("formula_payment_schedules")
PaymentRecord        @@map("formula_payment_records")
Logistics            @@map("formula_logistics")
LogisticsVehicle     @@map("formula_logistics_vehicles")
Invoice              @@map("formula_invoices")
Share                @@map("formula_shares")
FormulaVersion       @@map("formula_versions")
CalculationSnapshot  @@map("formula_calculation_snapshots")
StatusLog            @@map("formula_status_logs")
AuditLog             @@map("audit_logs")
```

### 2.2 GENERATED 컬럼 처리 방법 — Prisma 모델에서 제외

`formula_participants.total_buy_amount`/`total_sell_amount`,
`formula_invoices.total_amount`는 PostgreSQL이 `GENERATED ALWAYS AS
... STORED`로 직접 계산하는 컬럼이다.

**설계 결정**: 이 3개 컬럼은 Prisma 모델 필드에 **포함하지 않는다.**
이유:
- Prisma Client로 이 컬럼에 값을 쓰려고 하면 PostgreSQL이 거부한다
  (GENERATED 컬럼은 쓰기 불가).
- Prisma가 모델 필드로 선언하면 Prisma Client 타입에 "쓰기 가능한
  필드"로 노출되어, 개발자가 실수로 값을 넣으려는 코드를 작성할
  위험이 생긴다.
- 이 값이 필요한 조회는 Repository에서 `$queryRaw` 또는 Prisma의
  `select`에 raw 컬럼을 포함하는 방식 대신, 명시적으로 별도 조회
  메서드(`getWithComputedTotals()` 등)를 두어 raw SQL로 읽는다.

### 2.3 formula_no 처리 방법 — dbgenerated 사용, 직접 쓰기 금지

```
Prisma 표현 (설계 의도, 실제 파일 아님):

model Formula {
  formulaNo String @map("formula_no") @default(dbgenerated("generate_formula_no()"))
  ...
}
```

`@default(dbgenerated(...))`는 Prisma가 그 함수를 정의하거나 호출하는
것이 아니라, "이 컬럼의 기본값은 DB가 결정한다"는 사실을 Prisma
Client에게 알려주는 것뿐이다. `generate_formula_no()` 함수 자체는
`tocs_base_schema.sql`에 이미 정의되어 있다. API_SPEC_v1.1 핵심 정책
1(formula_no 직접 지정 금지)에 따라, Prisma Create 호출 시 이 필드를
절대 명시적으로 채우지 않는다 — Service Layer가 이를 보장한다(구현
계획 문서 3.1절).

### 2.4 ENUM 매핑

10개 PostgreSQL ENUM(`trade_type`, `role_group`, `nature_group`,
`payment_group`, `payment_direction`, `payment_status`,
`logistics_cost_type`, `invoice_status`, `trade_status`,
`status_target`)은 Prisma `enum` 블록으로 1:1 매핑한다. 값 추가/변경
시 PostgreSQL ENUM이 먼저 변경되고, Prisma `enum`은 그 변경을
**뒤따라 동기화**한다(역방향 아님 — Prisma가 먼저 ENUM 값을 정의하고
DB에 반영하는 흐름은 사용하지 않음).

### 2.5 복합 FK — Prisma 미표현, 주석으로만 명시

7개 복합 FK(`fk_schedule_participant_formula` 등)는 Prisma
`@relation`이 표현할 수 없다(Prisma는 단일 컬럼 FK만 지원). 각
Model에 해당 단일 컬럼 FK(`participantId`, `paymentScheduleId` 등)는
일반 `@relation`으로 표현하되, "이 FK는 실제로는 `(컬럼, formula_id)`
복합 FK로 동일 Formula 소속 여부까지 DB가 강제한다"는 사실을 모델
주석으로 남긴다. Prisma Client를 통한 INSERT/UPDATE가 이 복합 FK를
위반하면 PostgreSQL이 에러를 던지며, Repository는 이 에러를 그대로
Service로 전파한다(Prisma가 사전에 막아주지 않음을 전제로 코드를
작성해야 한다).

---

## 3. View 조회 전략

### 3.1 View를 Prisma Model로 만들지 않는 이유

Prisma는 PostgreSQL View를 `model`로 선언할 수 있지만(읽기 전용
매핑), 이 경우 Prisma Migrate가 해당 View를 "관리 대상 스키마
객체"로 인식하려 시도하면서 Source of Truth 충돌이 발생할 수 있다.
TOCS는 Prisma Migrate를 사용하지 않으므로 이 위험은 기술적으로는
낮지만, "Prisma가 View를 안다"는 인상 자체가 DECISION_LOG DL-017의
원칙(PostgreSQL = Source of Truth)과 충돌하는 설계 신호이므로 채택하지
않는다.

### 3.2 채택 방식 — Repository 내 `$queryRaw` 한정 사용

6개 View 전부 다음 방식으로만 조회한다.

```
설계 의도 (코드 아님):

KpiViewRepository.getConfirmedKpi(formulaId) ->
  prisma.$queryRaw`SELECT * FROM v_formula_confirmed_kpi WHERE formula_id = ${formulaId}`

KpiViewRepository.getProfitEngine(formulaId) ->
  prisma.$queryRaw`SELECT * FROM v_formula_profit_engine WHERE formula_id = ${formulaId}`
```

이 메서드들은 `KpiViewRepository`, `InvoiceStatusViewRepository`,
`PaymentUnmatchedViewRepository`, `CloseableViewRepository` 등으로
View 단위로 분리하며, 각 메서드의 반환 타입은 Prisma가 자동 생성하지
않으므로 **수동으로 TypeScript 타입을 정의**한다(View의 SELECT
컬럼 목록을 그대로 따름).

### 3.3 View별 조회 책임 매핑

| View | 조회 책임 모듈 (구현 계획 기준) |
|---|---|
| `v_formula_confirmed_kpi` | Dashboard 모듈 (9.1, 9.3) |
| `v_participant_confirmed_kpi` | Dashboard 모듈 (9.4) |
| `v_formula_profit_engine` | Dashboard 모듈 (9.2), Version 모듈(7.4) |
| `v_formula_invoice_status` | Invoice 모듈 (4.2, 4.3 동기화) |
| `v_payment_unmatched` | Payment 모듈 (3.4 보조) |
| `v_formula_closeable` | Cancel/Close 모듈 (8.2 선검증) |

---

## 4. CHECK Constraint / Trigger에 대한 Backend 코드의 태도

Backend는 10개 CHECK와 3개 Trigger가 강제하는 규칙을 **사전에
재검증하지 않는다.** 이미 PostgreSQL이 검증하므로 중복 검증은
불필요하며, 오히려 두 곳에서 다른 기준으로 검증하면 불일치 위험이
생긴다.

Backend가 해야 하는 유일한 일은: PostgreSQL이 던지는 에러
(`SQLSTATE 23514` CHECK 위반, `23505` UNIQUE 위반, Trigger의
`RAISE EXCEPTION`)를 **사용자 친화적 메시지로 변환**하는 것뿐이다.
이 변환 로직은 Service Layer에 위치한다(구현 계획 문서 1.1절).

예외) `chk_closed_requires_all_completed`와 같이 "사전에 막을 수
있다면 사용자 경험이 더 좋아지는" 경우, Service가 DB 호출 전에
`v_formula_closeable.can_close`를 조회해 선제 안내를 줄 수 있다
(구현 계획 3.7절, 8.2). 이는 "DB 검증을 대체"하는 것이 아니라
"DB가 어차피 거부할 것을 사용자에게 더 빨리 알려주는" 보조 동작이다.
최종 정합성 보장은 여전히 DB CHECK가 담당한다.

---

## 5. Prisma Client 생성/관리 정책

- `prisma generate`만 사용한다. `prisma migrate dev/deploy`는
  사용하지 않는다(Source of Truth는 SQL 파일이므로 Prisma가 스키마
  변경을 주도하지 않음).
- `schema.prisma`가 실제 DB 구조와 어긋나는 경우(예: SQL 파일이
  먼저 변경된 경우), `schema.prisma`를 SQL 파일에 맞춰 수동으로
  업데이트한 뒤 `prisma generate`로 클라이언트만 재생성한다. 이
  순서가 거꾸로 되는 일(`schema.prisma`를 먼저 바꾸고 그걸 DB에
  반영)은 발생해서는 안 된다.

---

## 6. 다음 단계 (이 문서 밖)

본 문서는 설계만 다룬다. 실제 `schema.prisma` 작성, Repository 코드
구현은 이 설계가 승인된 이후의 별도 작업이며 본 문서 범위 밖이다.
