# TOCS_API_SPEC_v1.0

## 문서 목적

본 문서는 TOCS DB Core(TEST-001~010 PASS, Profit Engine patch 병합 완료,
운영 DB 적용 순서 확정 상태) 기준으로 작성된 API 명세 초안이다.

본 문서는 다음을 금지한다.

- SQL/Migration 생성
- DB 구조 변경
- 코드 구현
- 검증되지 않은 동작에 대한 추측

모든 Request/Response 필드, 테이블/View 참조, 비즈니스 규칙은 현재
확정된 DB 스키마(`tocs_base_schema.sql` + `tocs_supplement.sql` +
`tocs_fix_amount_verified.sql`)에 실제로 존재하는 컬럼/제약/View에만
근거한다. DB에 없는 동작을 API가 임의로 만들어내지 않는다.

---

## 핵심 정책 (모든 API 영역에 공통 적용)

이 9개 정책은 DB Core 검증 과정(Round 1~11B)에서 실제로 확정된 사실이며,
API 설계 전체에 우선 적용된다.

1. **formula_no는 절대 직접 지정하지 않는다.** `formulas.formula_no`는
   `DEFAULT generate_formula_no()`로만 생성된다. API는 Formula 생성
   요청에 `formula_no` 필드를 절대 받지 않는다(TEST-008에서 직접 지정
   시 Sequence 불일치로 향후 UNIQUE 충돌 위험이 실증됨).
2. **`formulas.invoice_status`는 DB Trigger가 갱신하지 않는다.** API가
   `v_formula_invoice_status.derived_invoice_status`를 조회하여 그 결과를
   `formulas.invoice_status`에 반영할 책임을 갖는다.
3. **`formula_shares` 변경 시 `formula_calculation_snapshots.total_share`
   재계산은 API 책임이다.** DB는 두 값을 자동 동기화하지 않는다.
4. **`v_formula_profit_engine`은 `formula_versions.version_no DESC`
   기준으로 최신 snapshot을 선택한다**(created_at 단독 기준 아님,
   v1.6.2 patch 병합 완료). API는 이 View가 항상 "가장 높은 version_no"의
   snapshot을 반환한다고 가정해도 된다.
5. **`formula_payment_records.is_canceled`와 `formulas.*_status = 'CANCELED'`는
   완전히 독립된 메커니즘이다.** 전자는 개별 입출금 거래의 취소, 후자는
   Formula 전체 취소다. 하나가 바뀐다고 다른 하나가 자동으로 바뀌지 않는다.
6. **취소된(CANCELED) Formula도 DB KPI View에는 실제 입출금이 그대로
   반영된다.** `v_formula_confirmed_kpi`, `v_formula_profit_engine`,
   `v_participant_confirmed_kpi`는 `formulas`의 상태 컬럼을 필터링
   조건으로 사용하지 않는다. 취소 거래를 화면/리포트에서 제외하는 것은
   **API/UI의 책임**이며 DB가 대신 해주지 않는다.
7. **`is_closed = TRUE`는 정상 완료 종결만 의미한다.** 취소는 종결이
   아니다. `chk_closed_requires_all_completed` CHECK는 `is_closed = TRUE`
   상태에서 6개 상태 중 하나라도 `CANCELED`이면 DB 레벨에서 거부한다.
8. **`formula_versions.version_no`는 자동 생성되지 않는다.** API가
   `MAX(version_no) + 1`을 계산해서 INSERT해야 하며, 동시 요청으로 인한
   `UNIQUE(formula_id, version_no)` 충돌(SQLSTATE 23505)은 버그가 아니라
   정상적인 동시성 방어 결과다. API는 재조회 후 재시도해야 한다.
9. **`formula_calculation_snapshots.formula_version_id`는 복합 FK로
   `formula_versions(id, formula_id)`를 참조한다.** Version 생성이
   실패하면 그 Version에 연결하려던 Snapshot도 함께 무효화된다.

---

# 1. Formula API

## 1.1 Formula 생성

| 항목 | 내용 |
|---|---|
| Method | `POST` |
| Endpoint | `/api/v1/formulas` |
| 목적 | 새 Formula(거래 단위 원장)를 생성한다. Formula 1개 = 품목 1개 |

**Request Body**
```json
{
  "trade_type": "DOMESTIC",
  "item_id": "uuid",
  "unit": "kg",
  "quantity": 1000,
  "base_currency": "KRW",
  "foreign_currency": null,
  "departure_country": null,
  "arrival_country": null,
  "contract_exchange_rate": null,
  "adjusted_exchange_rate": null,
  "content": "string",
  "note": "string",
  "created_by": "string"
}
```
**`formula_no` 필드는 절대 받지 않는다.** (핵심 정책 1)

**Response Body**
```json
{
  "id": "uuid",
  "formula_no": "FM-2606-00012",
  "trade_type": "DOMESTIC",
  "trade_status": "DRAFT",
  "delivery_status": "DRAFT",
  "cash_in_status": "PENDING",
  "cash_out_status": "PENDING",
  "invoice_status": "NOT_ISSUED",
  "logistics_status": "DRAFT",
  "is_closed": false,
  "created_at": "timestamp"
}
```

- **DB 사용 테이블/View**: `formulas` (INSERT)
- **핵심 비즈니스 규칙**:
  - `formula_no`는 `DEFAULT generate_formula_no()`로 DB가 채번한다.
  - `trade_type != 'DOMESTIC'`이면 `foreign_currency`/`contract_exchange_rate`
    입력이 허용된다(`chk_domestic_no_exchange`).
  - 6개 상태 컬럼은 모두 기본값(`DRAFT`/`PENDING`/`NOT_ISSUED`)으로
    시작하며 API는 생성 시점에 이를 임의로 다른 값으로 지정하지 않는다.
- **실패 케이스**:
  - `item_id`가 `items` 테이블에 존재하지 않음 → FK 위반.
  - `trade_type = 'DOMESTIC'`인데 `foreign_currency` 입력 → CHECK 위반.
- **API Layer 책임**: 없음(이 엔드포인트는 DB 제약을 그대로 전달).

## 1.2 Formula 단건 조회

| 항목 | 내용 |
|---|---|
| Method | `GET` |
| Endpoint | `/api/v1/formulas/{formula_id}` |
| 목적 | Formula 기본 정보 및 6개 상태 조회 |

**Response Body**: 1.1의 Response와 동일 구조 + `quantity`, `unit`,
`item_id`, `closed_at` 포함.

- **DB 사용 테이블/View**: `formulas` (SELECT)
- **실패 케이스**: `formula_id` 미존재 → 404.

## 1.3 Formula 목록 조회

| 항목 | 내용 |
|---|---|
| Method | `GET` |
| Endpoint | `/api/v1/formulas` |
| 목적 | 조건별 Formula 목록 조회 |

**Query Parameters**: `trade_status`, `is_closed`, `created_after`,
`created_before`, `page`, `page_size`

- **DB 사용 테이블/View**: `formulas` (SELECT, `idx_formulas_trade_status`,
  `idx_formulas_is_closed`, `idx_formulas_created_at` 활용 가능)
- **핵심 비즈니스 규칙**: 기본 정렬은 `created_at DESC`.

## 1.4 Formula 수정

| 항목 | 내용 |
|---|---|
| Method | `PATCH` |
| Endpoint | `/api/v1/formulas/{formula_id}` |
| 목적 | Formula 기본 속성(content, note, unit 등) 수정 |

**Request Body**: 수정 가능 필드만 부분 포함 (`content`, `note`,
`unit`, `quantity`, `contract_exchange_rate`, `adjusted_exchange_rate`)

- **DB 사용 테이블/View**: `formulas` (UPDATE)
- **핵심 비즈니스 규칙**:
  - `formula_no`, `trade_type`, 6개 상태 컬럼, `is_closed`,
    `closed_at`은 이 엔드포인트로 수정할 수 없다(각각 전용 엔드포인트
    — 1.5, 7번, 8번 참조).
  - `quantity` 변경은 Version 생성 대상이다(7. Version API 참조).
    이 엔드포인트가 `quantity`를 받으면 내부적으로 Version API의
    로직을 호출해야 하며, 단순 UPDATE만 수행하지 않는다.
- **실패 케이스**: `is_closed = TRUE`인 Formula 수정 시도 → API가
  명시적으로 거부해야 한다(DB는 `formulas` 일반 컬럼 UPDATE 자체를
  막지 않으므로, 이 보호는 **API Layer 책임**이다).

## 1.5 Formula 상태 조회 (종결 가능 여부 포함)

| 항목 | 내용 |
|---|---|
| Method | `GET` |
| Endpoint | `/api/v1/formulas/{formula_id}/status` |
| 목적 | 6개 상태 + 종결 가능 여부(`can_close`) 조회 |

**Response Body**
```json
{
  "formula_id": "uuid",
  "trade_status": "IN_PROGRESS",
  "delivery_status": "IN_PROGRESS",
  "cash_in_status": "PARTIAL",
  "cash_out_status": "PARTIAL",
  "invoice_status": "ISSUED",
  "logistics_status": "DRAFT",
  "can_close": false,
  "is_closed": false
}
```

- **DB 사용 테이블/View**: `v_formula_closeable`
- **핵심 비즈니스 규칙**: `can_close`는 6개 상태가 전부
  `COMPLETED`/`AMOUNT_MATCHED`일 때만 `TRUE`. 이 값은 DB View가 계산하며
  API는 그대로 전달한다.

---

# 2. Company / Participant API

## 2.1 회사 등록

| 항목 | 내용 |
|---|---|
| Method | `POST` |
| Endpoint | `/api/v1/companies` |
| 목적 | 거래 참여 가능한 회사 등록 |

**Request Body**
```json
{
  "company_name": "string",
  "business_reg_no": "string",
  "representative_name": "string",
  "main_phone": "string",
  "hq_address": "string",
  "memo": "string"
}
```

**Response Body**: 입력값 + `id`, `is_active: true`, `created_at`

- **DB 사용 테이블/View**: `companies` (INSERT)
- **핵심 비즈니스 규칙**: `business_reg_no`는 `UNIQUE`. Company는
  고정 역할을 갖지 않는다 — 역할은 Formula별 `formula_participants`에서
  결정된다(이 엔드포인트는 역할을 받지 않는다).
- **실패 케이스**: `business_reg_no` 중복 → 409 Conflict.

## 2.2 회사 조회 / 목록

| 항목 | 내용 |
|---|---|
| Method | `GET` |
| Endpoint | `/api/v1/companies/{company_id}`, `/api/v1/companies` |
| 목적 | 회사 단건/목록 조회 |

- **DB 사용 테이블/View**: `companies`, `company_contacts` (JOIN 가능)

## 2.3 Formula 참여자 추가

| 항목 | 내용 |
|---|---|
| Method | `POST` |
| Endpoint | `/api/v1/formulas/{formula_id}/participants` |
| 목적 | Formula에 거래 라인 참여자 추가 (A>B>C>D 구조) |

**Request Body**
```json
{
  "company_id": "uuid",
  "sequence_order": 2,
  "role_group": "BUYER",
  "nature_group": "DISTRIBUTOR",
  "payment_group": "CREDIT",
  "buy_unit_price": 1000,
  "sell_unit_price": 1500,
  "quantity": null,
  "direct_cost_amount": 0,
  "is_start_point": false,
  "is_end_point": false
}
```

- **DB 사용 테이블/View**: `formula_participants` (INSERT)
- **핵심 비즈니스 규칙**:
  - `quantity`를 생략하면 API가 `formulas.quantity` 값을 자동 상속하여
    INSERT한다(`formula_participants.quantity`는 `NOT NULL`이므로 DB가
    빈 값을 받지 않음). API가 이 상속 책임을 진다.
  - `sequence_order`는 `formula_id` 내에서 `UNIQUE`, `> 0`이어야 한다.
  - `is_start_point`/`is_end_point`는 Formula당 각각 최대 1개만
    `TRUE`일 수 있다(`uq_fp_one_start_point`, `uq_fp_one_end_point`).
  - 동일 `company_id`가 동일 Formula에서 복수 역할로 참여 가능하다
    (`UNIQUE(formula_id, company_id)` 제약 없음, 의도된 설계).
  - `formula_participants.total_buy_amount`/`total_sell_amount`는
    `quantity * unit_price`로 DB가 자동 계산(GENERATED)하므로 API가
    별도로 계산해서 전달하지 않는다.
- **실패 케이스**:
  - `sequence_order <= 0` → CHECK 위반.
  - 동일 Formula에 시작점/종료점이 이미 존재하는데 추가 시도 → UNIQUE
    INDEX 위반.

## 2.4 참여자 순서 관리

| 항목 | 내용 |
|---|---|
| Method | `PATCH` |
| Endpoint | `/api/v1/formulas/{formula_id}/participants/{participant_id}/order` |
| 목적 | 참여자의 `sequence_order` 변경 |

- **DB 사용 테이블/View**: `formula_participants` (UPDATE)
- **핵심 비즈니스 규칙**: 두 참여자의 순서를 동시에 swap해야 하는 경우,
  `UNIQUE(formula_id, sequence_order)` 제약 때문에 단순 UPDATE 2회로는
  중간에 충돌이 발생할 수 있다. **API는 임시로 존재하지 않는 음수 또는
  큰 값으로 한쪽을 먼저 옮긴 뒤 재배치하는 트랜잭션을 구성해야 한다**
  (이 처리 로직은 API 책임이며 DB가 대신하지 않는다).

---

# 3. Payment API

## 3.1 입출금 예정 등록

| 항목 | 내용 |
|---|---|
| Method | `POST` |
| Endpoint | `/api/v1/formulas/{formula_id}/payment-schedules` |
| 목적 | 입금/출금 예정 항목 등록 |

**Request Body**
```json
{
  "participant_id": "uuid",
  "direction": "IN",
  "payment_type": "CREDIT",
  "counterparty_company_id": "uuid",
  "scheduled_amount": 1000000,
  "scheduled_date": "2026-12-01"
}
```

- **DB 사용 테이블/View**: `formula_payment_schedules` (INSERT)
- **핵심 비즈니스 규칙**: `scheduled_amount > 0`. `participant_id`가
  주어지면 동일 `formula_id` 소속이어야 한다(`fk_schedule_participant_formula`
  복합 FK, `MATCH SIMPLE`이므로 `participant_id`는 NULL도 허용).
- **실패 케이스**: `participant_id`가 다른 Formula 소속 → 복합 FK 위반.

## 3.2 실제 입출금 기록

| 항목 | 내용 |
|---|---|
| Method | `POST` |
| Endpoint | `/api/v1/formulas/{formula_id}/payment-records` |
| 목적 | 실제 발생한 입출금을 기록 |

**Request Body**
```json
{
  "payment_schedule_id": "uuid",
  "participant_id": "uuid",
  "direction": "IN",
  "counterparty_company_id": "uuid",
  "actual_amount": 500000,
  "actual_date": "2026-12-01",
  "bank_name": "string",
  "account_name": "string",
  "account_no": "string",
  "confirmed_by": "string",
  "status": "COMPLETED"
}
```

- **DB 사용 테이블/View**: `formula_payment_records` (INSERT)
- **핵심 비즈니스 규칙**:
  - `direction`은 `payment_schedule_id`가 가리키는 schedule의
    `direction`과 반드시 일치해야 한다(`trg_check_record_direction`
    트리거가 DB 레벨에서 강제). 불일치 시 INSERT가 실패한다.
  - `status = 'COMPLETED'`이면 `confirmed_at`이 자동으로 요구된다
    (`chk_confirmed_consistency`) — API는 `status='COMPLETED'`를
    보낼 때 `confirmed_at`도 함께 채워야 한다.
  - 분할입금/분할출금은 동일 `payment_schedule_id`에 여러 record를
    생성하는 것으로 표현한다(다건 INSERT 허용, DB가 막지 않음).
  - **`payment_schedule_id`를 생략할 수 있다**(예정 없이 입금되는
    경우). 이 경우 해당 record는 `v_payment_unmatched`에 노출되며,
    실무자가 추후 매칭할 수 있다.
- **실패 케이스**:
  - `direction`이 schedule과 불일치 → 트리거 예외.
  - `actual_amount <= 0` → CHECK 위반.

## 3.3 완료취소

| 항목 | 내용 |
|---|---|
| Method | `PATCH` |
| Endpoint | `/api/v1/payment-records/{record_id}/cancel` |
| 목적 | 입출금 기록을 취소 처리(삭제 아님) |

**Request Body**
```json
{ "cancel_reason": "string" }
```

- **DB 사용 테이블/View**: `formula_payment_records` (UPDATE)
- **핵심 비즈니스 규칙**:
  - DB는 record 삭제를 허용하지 않는 정책을 따른다 — `is_canceled = TRUE`,
    `canceled_at = NOW()`로 UPDATE한다(`chk_cancel_consistency`).
  - **이 취소는 `formula_payment_records.is_canceled`에만 영향을 준다.
    `formulas.cash_in_status`/`cash_out_status`(전체 상태)는 자동으로
    바뀌지 않는다.** 이 두 메커니즘은 완전히 독립이다(핵심 정책 5).
  - 취소된 record는 모든 KPI View(`v_formula_confirmed_kpi` 등)의
    `confirmed_*` 계산에서 자동 제외된다(View가
    `WHERE NOT is_canceled`를 사용).
- **실패 케이스**: 이미 `is_canceled = TRUE`인 record 재취소 시도 →
  API가 멱등하게 처리하거나 409 반환(정책 미확정, 9.3 참조).

## 3.4 미수/미지급 조회

| 항목 | 내용 |
|---|---|
| Method | `GET` |
| Endpoint | `/api/v1/formulas/{formula_id}/receivable-payable` |
| 목적 | 미수금/미지급금/입금률/출금률 조회 |

**Response Body**
```json
{
  "scheduled_revenue": 2000000,
  "confirmed_revenue": 1000000,
  "receivable": 1000000,
  "receive_rate": 50.00,
  "scheduled_payment": 1000000,
  "confirmed_payment": 500000,
  "payable": 500000,
  "payment_rate": 50.00
}
```

- **DB 사용 테이블/View**: `v_formula_confirmed_kpi`
- **핵심 비즈니스 규칙**: `receive_rate`/`payment_rate`는 예정금액이
  0일 때만 `NULL`, 그 외에는 0.00~100.00 사이 값(또는 초과입금 시
  100 초과 가능, DB가 막지 않음).

---

# 4. Invoice API

## 4.1 계산서 등록

| 항목 | 내용 |
|---|---|
| Method | `POST` |
| Endpoint | `/api/v1/formulas/{formula_id}/invoices` |
| 목적 | 계산서 등록 (참여자 간 발행/수취) |

**Request Body**
```json
{
  "issuer_company_id": "uuid",
  "receiver_company_id": "uuid",
  "issuer_participant_id": "uuid",
  "receiver_participant_id": "uuid",
  "sequence_order": 1,
  "invoice_no": "string",
  "invoice_date": "2026-12-01",
  "external_invoice_amount": 1100000,
  "supply_amount": 1000000,
  "tax_amount": 100000,
  "status": "ISSUED"
}
```

- **DB 사용 테이블/View**: `formula_invoices` (INSERT)
- **핵심 비즈니스 규칙**:
  - `amount_verified`는 API가 보낼 필요 없다. DB 트리거
    (`trg_sync_invoice_amount_verified`)가 `external_invoice_amount`와
    `total_amount`(=`supply_amount + tax_amount`, GENERATED)를 비교하여
    자동 계산한다.
  - `issuer_participant_id`/`receiver_participant_id`가 주어지면 그
    participant의 `company_id`가 각각 `issuer_company_id`/
    `receiver_company_id`와 일치해야 한다(`trg_check_invoice_participant_company`
    트리거가 강제). 불일치 시 INSERT 실패.
  - `issuer_company_id != receiver_company_id` 필수.
- **실패 케이스**:
  - participant-company 불일치 → 트리거 예외.
  - `issuer_company_id = receiver_company_id` → CHECK 위반.

## 4.2 계산서 상태 조회

| 항목 | 내용 |
|---|---|
| Method | `GET` |
| Endpoint | `/api/v1/formulas/{formula_id}/invoices/status` |
| 목적 | Formula의 전체 계산서 파생 상태 조회 |

**Response Body**
```json
{
  "active_count": 2,
  "matched_count": 1,
  "mismatched_count": 0,
  "in_progress_count": 1,
  "derived_invoice_status": "ISSUED"
}
```

- **DB 사용 테이블/View**: `v_formula_invoice_status`
- **핵심 비즈니스 규칙**: 계산서 0건이면 `derived_invoice_status = 'NOT_ISSUED'`
  (View가 `formulas`를 `LEFT JOIN`하므로 0건 Formula도 누락되지 않음).

## 4.3 formula.invoice_status 동기화 — **API 책임 명시**

| 항목 | 내용 |
|---|---|
| Method | `PATCH` (내부 처리, 4.1 등록/수정 직후 자동 호출) |
| Endpoint | (전용 엔드포인트 없음 — 4.1/계산서 상태 변경 시 내부적으로 수행) |
| 목적 | `formulas.invoice_status` 컬럼을 실제 계산서 상태와 일치시킴 |

**핵심 비즈니스 규칙 (반드시 준수)**:
- `formulas.invoice_status`를 자동으로 갱신하는 DB Trigger는 **존재하지
  않는다.** 계산서가 등록/수정/취소될 때마다 API는 다음을 수행해야 한다:
  1. `v_formula_invoice_status`에서 해당 `formula_id`의
     `derived_invoice_status`를 조회한다.
  2. 그 값을 `formulas.invoice_status`에 `UPDATE`한다.
- 이 동기화를 누락하면 `formulas.invoice_status`가 실제 계산서 상태와
  영구히 어긋난 채로 남는다(DB가 이 불일치를 감지하거나 막지 않음).
- 4.1(계산서 등록), 계산서 수정, 계산서 취소 — 이 세 작업 모두 이
  동기화를 트리거해야 한다.

---

# 5. Logistics API

## 5.1 운송 정보 등록

| 항목 | 내용 |
|---|---|
| Method | `POST` |
| Endpoint | `/api/v1/formulas/{formula_id}/logistics` |
| 목적 | 운송 4주체(carrier/departure/arrival/cost_bearer) 등록 |

**Request Body**
```json
{
  "carrier_company_id": "uuid",
  "departure_company_id": "uuid",
  "arrival_company_id": "uuid",
  "cost_bearer_company_id": "uuid",
  "cost_type": "SEPARATE_COST",
  "departure_location": "string",
  "arrival_location": "string",
  "item_description": "string",
  "transport_quantity": 1000,
  "vehicle_count": 1,
  "total_logistics_cost": 300000,
  "scheduled_date": "2026-12-01"
}
```

- **DB 사용 테이블/View**: `formula_logistics` (INSERT)
- **핵심 비즈니스 규칙**:
  - `carrier_company_id`는 `NOT NULL`(세금계산서 발행 운송사업체).
    `departure_company_id`/`arrival_company_id`/`cost_bearer_company_id`는
    nullable이지만, **`total_logistics_cost > 0`이면
    `cost_bearer_company_id`는 필수**(`chk_logistics_cost_bearer` CHECK).
  - `cost_type`은 `INCLUDED_IN_BUY_PRICE`/`INCLUDED_IN_SELL_PRICE`/
    `SEPARATE_COST` 중 하나만 가능(다른 값은 DB가 거부).
- **실패 케이스**: 운송비 입력했는데 `cost_bearer_company_id` 누락 →
  CHECK 위반.

## 5.2 운송비 등록

운송비 자체는 5.1의 `total_logistics_cost`로 등록되며, 별도
엔드포인트는 없다. 다만 운송비를 **실제로 지급**하는 행위는 3.2(실제
입출금 기록)의 `OUT` 방향 record로 별도 등록해야 한다.

- **핵심 비즈니스 규칙**: `formula_logistics.total_logistics_cost`는
  "운송비가 얼마인가"를 나타내는 계획값이며, 실제 지급은 별도의
  `formula_payment_records` 레코드(3.2)로 기록되어야 확정순이익에
  반영된다(TEST-005에서 실증). 두 단계를 혼동하지 않는다.

## 5.3 운송 상태 변경

| 항목 | 내용 |
|---|---|
| Method | `PATCH` |
| Endpoint | `/api/v1/formulas/{formula_id}/logistics-status` |
| 목적 | `formulas.logistics_status` 변경 |

**Request Body**
```json
{ "new_status": "COMPLETED", "changed_by": "string", "change_reason": "string" }
```

- **DB 사용 테이블/View**: `formulas` (UPDATE), `formula_status_logs`
  (INSERT), `audit_logs` (INSERT)
- **핵심 비즈니스 규칙**: 상태 변경 시 `formula_status_logs` +
  `audit_logs`를 **동시에** 기록해야 한다(API가 하나의 트랜잭션으로
  묶어야 함 — DB가 자동으로 로그를 생성하지 않음).

---

# 6. Share API

## 6.1 정액 Share 등록

| 항목 | 내용 |
|---|---|
| Method | `POST` |
| Endpoint | `/api/v1/formulas/{formula_id}/shares` |
| 목적 | 정액(FIXED_AMOUNT) 셰어 등록 |

**Request Body**
```json
{
  "participant_id": "uuid",
  "target_company_id": "uuid",
  "share_basis": "DIRECT",
  "share_method": "FIXED_AMOUNT",
  "share_rate": null,
  "share_amount": 200000
}
```

- **DB 사용 테이블/View**: `formula_shares` (INSERT)
- **핵심 비즈니스 규칙**: `formula_shares`가 셰어의 Source of Truth다.
  `formula_participants`에는 셰어 관련 컬럼이 전혀 없다(v1.2에서 제거,
  스키마 레벨로 강제됨).

## 6.2 정률 Share 등록

**Request Body**
```json
{
  "participant_id": "uuid",
  "target_company_id": "uuid",
  "share_basis": "PROFIT",
  "share_method": "RATE",
  "share_rate": 10.0,
  "share_amount": 100000
}
```

- **핵심 비즈니스 규칙**: `share_rate`(정률, %)를 받았더라도
  `share_amount`(실제 금액)는 **API가 계산해서 함께 저장해야 한다.**
  DB는 `share_rate`로부터 `share_amount`를 자동 계산하지 않는다
  (둘 다 단순 컬럼).

## 6.3 Share 변경 시 Snapshot 재계산 — **API 책임 명시**

**핵심 비즈니스 규칙 (반드시 준수)**:
- `formula_shares`(상세 원장)와
  `formula_calculation_snapshots.total_share`(집계 스냅샷)는 **DB가
  자동으로 동기화하지 않는다.**
- `formula_shares`에 추가/수정/삭제가 발생하면 API는:
  1. 해당 `formula_id`의 모든 `formula_shares.share_amount`를 합산한다.
  2. 새 `formula_calculation_snapshots` 행을 생성하거나(Version 변경을
     동반하는 경우 7번 Version API와 연계), 기존 최신 snapshot의
     `total_share`를 갱신한다(정책 미확정 — 9.2 참조).
  3. 이 합산값과 `v_formula_profit_engine.expected_share`가 실제로
     일치하는지 확인 가능해야 한다.
- 이 동기화를 누락하면 `expected_net_profit`이 실제 셰어 변경을
  반영하지 못한 채로 남는다.

---

# 7. Version API

## 7.1 새 버전 생성

| 항목 | 내용 |
|---|---|
| Method | `POST` |
| Endpoint | `/api/v1/formulas/{formula_id}/versions` |
| 목적 | 단가/수량/참여자/운송비/환율/셰어 변경 시 새 Version + Snapshot 생성 |

**Request Body**
*(`calculation` 객체의 각 필드는 `formula_calculation_snapshots` 테이블의
동일 이름 컬럼에 그대로 매핑된다. `calculation` 자체는 API 요청 구조의
wrapper 키일 뿐 DB 컬럼이 아니다.)*
```json
{
  "changed_by": "string",
  "change_reason": "string",
  "snapshot": { "...": "변경 시점 전체 상태 JSON" },
  "calculation": {
    "quantity": 1000,
    "total_buy_amount": 1200000,
    "total_sell_amount": 1500000,
    "total_cost": 0,
    "total_share": 0,
    "net_profit": 300000,
    "profit_rate": 20.0,
    "exchange_rate_used": null,
    "snapshot_data": { "...": "계산 상세 JSON" }
  }
}
```

**Response Body**
```json
{
  "version_no": 3,
  "formula_version_id": "uuid",
  "snapshot_id": "uuid"
}
```
*(주: `formula_version_id`는 `formula_versions.id`, `snapshot_id`는
`formula_calculation_snapshots.id`를 가리키는 API 응답 별칭이다. DB
컬럼명 자체가 아니라 응답 구조 설계상의 alias임을 명시한다.)*

- **DB 사용 테이블/View**: `formula_versions` (INSERT),
  `formula_calculation_snapshots` (INSERT)
- **핵심 비즈니스 규칙 — version_no 충돌 시 API 재시도 정책 (필수)**:
  1. `version_no`는 DB가 자동 생성하지 않는다. API가
     `SELECT MAX(version_no) FROM formula_versions WHERE formula_id = ?`로
     계산한 뒤 `+1`하여 INSERT한다.
  2. 동시 요청으로 두 트랜잭션이 같은 `version_no`를 계산해 INSERT를
     시도하면, `UNIQUE(formula_id, version_no)` 위반(SQLSTATE 23505)이
     발생한다. **이는 버그가 아니라 정상적인 동시성 방어 결과다**
     (TEST-011/011B에서 실증).
  3. API는 이 충돌을 감지하면 `version_no`를 **재조회**하고 짧은
     backoff 후 **재시도**해야 한다. 재시도 횟수/backoff 간격은
     이번 명세에서 확정하지 않는다(9.1 참조).
  4. 재시도를 모두 소진한 뒤에도 실패하면, 사용자에게 "동시 편집
     충돌"임을 알리는 명시적 메시지를 반환해야 한다(일반 서버 오류로
     뭉뚱그리지 않는다).
  5. Version INSERT가 실패하면 그 Version의 `id` 자체가 생성되지
     않으므로, 연결하려던 Snapshot INSERT도 같은 트랜잭션에서 함께
     무효화되어야 한다(복합 FK `fk_snapshot_version_formula`가
     이 연쇄를 DB 레벨에서 강제).
- **실패 케이스**: `version_no` 충돌(23505) — 위 정책으로 처리.

## 7.2 버전 목록

| 항목 | 내용 |
|---|---|
| Method | `GET` |
| Endpoint | `/api/v1/formulas/{formula_id}/versions` |
| 목적 | 해당 Formula의 모든 Version 이력 조회 |

- **DB 사용 테이블/View**: `formula_versions` (SELECT,
  `idx_fv_formula_id`, `idx_fv_created_at` 활용)
- **핵심 비즈니스 규칙**: `version_no` 오름차순 정렬 기본.

## 7.3 버전 상세

| 항목 | 내용 |
|---|---|
| Method | `GET` |
| Endpoint | `/api/v1/formulas/{formula_id}/versions/{version_no}` |
| 목적 | 특정 버전의 snapshot(JSONB)과 그 시점 계산 결과 조회 |

- **DB 사용 테이블/View**: `formula_versions` JOIN
  `formula_calculation_snapshots` (`formula_version_id`로 연결)

## 7.4 최신 snapshot 조회

| 항목 | 내용 |
|---|---|
| Method | `GET` |
| Endpoint | `/api/v1/formulas/{formula_id}/versions/latest` |
| 목적 | 가장 최신 버전의 예상 KPI 조회 |

**Response Body**
```json
{
  "expected_revenue": 1500000,
  "expected_buy": 1200000,
  "expected_cost": 0,
  "expected_share": 0,
  "expected_net_profit": 300000,
  "expected_profit_rate": 20.0
}
```

- **DB 사용 테이블/View**: `v_formula_profit_engine`
- **핵심 비즈니스 규칙**: 이 View는 `formula_versions.version_no DESC`
  기준으로 최신 snapshot을 선택한다(v1.6.2 patch 병합 완료, created_at
  단독 기준 아님). API는 이 값을 그대로 신뢰하고 별도 재계산을 하지
  않는다.

---

# 8. Cancel / Close API

## 8.1 Formula 취소

| 항목 | 내용 |
|---|---|
| Method | `POST` |
| Endpoint | `/api/v1/formulas/{formula_id}/cancel` |
| 목적 | Formula 전체를 취소 상태로 전환 |

**Request Body**
```json
{ "cancel_reason": "string", "changed_by": "string" }
```

- **DB 사용 테이블/View**: `formulas` (UPDATE 6개 상태 컬럼),
  `formula_status_logs` (INSERT 6건), `audit_logs` (INSERT 1건)
- **핵심 비즈니스 규칙**:
  - 6개 상태(`trade_status`, `delivery_status`, `cash_in_status`,
    `cash_out_status`, `invoice_status`, `logistics_status`)를 전부
    `CANCELED`로 UPDATE한다.
  - **`is_closed`는 변경하지 않는다(`FALSE` 유지).** 취소는 종결이
    아니다(핵심 정책 7).
  - 6건의 `formula_status_logs` + 1건의 `audit_logs`를 같은
    트랜잭션에서 함께 기록해야 한다.
  - **이미 실제로 들어온/나간 입출금 record(`formula_payment_records`)는
    건드리지 않는다.** `is_canceled` 컬럼을 자동으로 `TRUE`로 바꾸지
    않는다(핵심 정책 5). 그 돈은 실제로 움직였기 때문이다.
- **실패 케이스 — DB 레벨 차단**:
  - **`is_closed = TRUE`인 Formula는 취소할 수 없다.** `chk_closed_requires_all_completed`
    CHECK가 `is_closed = TRUE`이면서 6개 상태 중 하나라도 `CANCELED`인
    조합을 거부한다(TEST-010에서 실증). API는 이 CHECK 위반을
    "정상 종결된 Formula는 취소 불가"라는 명확한 사용자 메시지로
    변환해야 한다.

## 8.2 Formula 종결

| 항목 | 내용 |
|---|---|
| Method | `POST` |
| Endpoint | `/api/v1/formulas/{formula_id}/close` |
| 목적 | 6개 상태가 모두 완료된 Formula를 정식 종결 |

**Request Body**: 없음(또는 `closed_by` 등 감사용 메타데이터만)

- **DB 사용 테이블/View**: `v_formula_closeable` (선검증), `formulas`
  (UPDATE `is_closed`, `closed_at`)
- **핵심 비즈니스 규칙**:
  1. API는 UPDATE 전에 **반드시** `v_formula_closeable.can_close`를
     먼저 조회하여 `TRUE`인지 확인해야 한다.
  2. `is_closed = TRUE`, `closed_at = NOW()`를 동시에 설정한다
     (`chk_closed_at_consistency`가 둘 중 하나만 설정하는 것을 거부).
- **실패 케이스**: 6개 상태 중 하나라도 미완료인데 종결 시도 →
  `chk_closed_requires_all_completed` CHECK 위반.

## 8.3 취소와 종결의 차이 (명세 필수 항목)

| 구분 | 취소 (Cancel) | 종결 (Close) |
|---|---|---|
| 의미 | 거래가 무효화됨 | 거래가 정상적으로 완료됨 |
| 대상 컬럼 | 6개 상태 → `CANCELED` | `is_closed` → `TRUE` |
| `is_closed` 영향 | 없음(`FALSE` 유지) | `TRUE`로 전환 |
| 선행 조건 | `is_closed = FALSE`여야 함(DB가 강제) | 6개 상태 전부 완료(`can_close=TRUE`)여야 함 |
| 실제 입출금 데이터 | 보존됨, 그대로 KPI에 반영 | 보존됨, 그대로 KPI에 반영 |
| 되돌릴 수 있는가 | 명세 미확정(9.4 참조) | 명세 미확정 |

---

# 9. Dashboard / KPI API

## 9.1 Confirmed KPI 조회

| 항목 | 내용 |
|---|---|
| Method | `GET` |
| Endpoint | `/api/v1/formulas/{formula_id}/kpi/confirmed` |
| 목적 | 실제 입출금 기준 확정 KPI 조회 |

**Response Body**
```json
{
  "confirmed_revenue": 1000000,
  "confirmed_payment": 500000,
  "confirmed_net_profit": 500000
}
```

- **DB 사용 테이블/View**: `v_formula_confirmed_kpi`, `v_formula_profit_engine`
- **핵심 비즈니스 규칙**: 확정순이익 = 실입금 - 실출금. 비용/셰어를
  별도로 차감하지 않는다(실출금에 이미 포함됨).

## 9.2 Expected KPI 조회

| 항목 | 내용 |
|---|---|
| Method | `GET` |
| Endpoint | `/api/v1/formulas/{formula_id}/kpi/expected` |
| 목적 | Formula 기준(최신 Version) 예상 KPI 조회 |

- **DB 사용 테이블/View**: `v_formula_profit_engine`
- **핵심 비즈니스 규칙**: 확정 KPI와 예상 KPI는 절대 같은 응답에서
  서로의 값으로 대체되지 않는다. 우연히 숫자가 같아지는 케이스(비용/셰어
  0인 경우, TEST-006 실증)가 있을 수 있으나 계산 경로는 항상 독립적이다.

## 9.3 Receivable/Payable 조회

3.4와 동일 (`v_formula_confirmed_kpi`).

## 9.4 Participant KPI 조회

| 항목 | 내용 |
|---|---|
| Method | `GET` |
| Endpoint | `/api/v1/formulas/{formula_id}/kpi/participants` |
| 목적 | 참여자(회사)별 KPI 조회 |

**Response Body**
```json
[
  {
    "participant_id": "uuid",
    "company_name": "GioWorks",
    "role_group": "BUYER",
    "confirmed_in": 1000000,
    "confirmed_out": 500000,
    "receivable": 0,
    "payable": 500000,
    "confirmed_net_profit": 500000
  }
]
```

- **DB 사용 테이블/View**: `v_participant_confirmed_kpi`
- **핵심 비즈니스 규칙 — 취소 필터는 API/UI 책임 (필수)**:
  - 이 View와 `v_formula_confirmed_kpi`/`v_formula_profit_engine`은
    `formulas.*_status`를 필터 조건으로 사용하지 않는다. **취소된
    (`CANCELED`) Formula의 KPI도 실제 입출금이 그대로 포함되어
    반환된다.**
  - `payment_schedule_id`가 NULL인 미매칭 record(`v_payment_unmatched`)는
    `participant_id`가 없으면 이 View의 집계에서 누락된다(의도된
    정책, Formula 전체 KPI에는 반영되지만 회사별 KPI에는 미반영).
  - **취소된 Formula를 대시보드/리포트에서 제외하고 싶다면, API가
    응답을 반환하기 전에 별도로 `formulas.*_status = 'CANCELED'` 또는
    `is_closed` 여부로 필터링해야 한다.** DB View는 이 필터링을
    수행하지 않는다.

---

# 미확정 정책 목록

본 명세에서 의도적으로 확정하지 않고 다음 단계로 넘긴 항목.

1. **Version 재시도 횟수/backoff 간격** (7.1) — 실제 동시 요청 빈도
   관측 후 결정.
2. **Share 변경 시 snapshot 갱신 방식** (6.3) — 새 Version을 항상
   동반 생성할지, 기존 최신 snapshot을 직접 UPDATE할지 미확정.
   (`formula_calculation_snapshots`는 현재 UPDATE 금지 컬럼이 없으므로
   기술적으로는 둘 다 가능하나, 어느 쪽이 TOCS 정책에 맞는지는 별도
   Decision 필요)
3. **이미 취소된 payment record 재취소 시도 처리** (3.3) — 멱등 처리
   vs 409 반환 중 미확정.
4. **취소/종결의 되돌리기(undo) 가능 여부** (8.3) — 현재 DB 제약은
   `is_closed=TRUE → CANCELED` 전환만 차단할 뿐, `CANCELED → 원상복구`
   또는 `is_closed=TRUE → FALSE` 전환 자체를 막는 CHECK는 없다. 이를
   API가 허용할지는 별도 정책 필요.
5. **Formula 일부 상태만 취소(부분 취소)** — 이번 명세는 "전체 취소"만
   다룬다(요청 범위 한정). 6개 상태 중 일부만 `CANCELED`로 만드는
   시나리오는 DB ENUM이 허용하지만 API 정책은 미정의.

---
