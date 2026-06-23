# TOCS_API_MASTER_SPEC_DRAFT_v1.0

## 0. 문서 목적

본 문서는 TOCS V1 API 설계 초안이다.

DB는 PostgreSQL Source of Truth 기준이며, API는 Formula First Architecture를 훼손하지 않는 범위에서 설계한다.

---

# 1. API 설계 원칙

## 1.1 Formula 중심

모든 핵심 API는 Formula를 기준으로 설계한다.

금지:

- Deal API를 최상위로 만들기
- Order API를 최상위로 만들기
- Project/Pipeline 중심 API 설계

허용:

- Formula 하위 resource로 participant/payment/invoice/logistics/share 관리

---

## 1.2 상태 자동 완료 금지

API는 상태를 자동으로 완료 처리하지 않는다.

실무자의 명시적 액션이 있을 때만 상태를 변경한다.

상태 변경 API는 반드시 아래를 트랜잭션으로 처리한다.

```text
formula_status_logs INSERT
audit_logs INSERT
formulas UPDATE
```

---

## 1.3 확정 KPI 기준

확정 KPI는 실제 payment_records 기준이다.

```text
확정매출 = 실제 입금
확정출금 = 실제 출금
확정순이익 = 실제 입금 - 실제 출금
```

---

# 2. API 그룹

## 2.1 Formula API

### POST /api/formulas

Formula 생성.

생성 범위:

- formula 기본정보
- item 연결
- trade_type
- currency / exchange_rate
- quantity
- created_by

주의:

- participant는 별도 API로 추가 가능
- Formula 생성만으로 거래 완료 상태가 되지 않음

---

### GET /api/formulas

Formula 목록 조회.

Query:

```text
company_id
trade_type
is_closed
cash_in_status
cash_out_status
invoice_status
logistics_status
delivery_status
date_from
date_to
keyword
```

---

### GET /api/formulas/:formulaId

Formula 상세 조회.

포함 데이터:

- formula
- item
- participants
- payment_schedules
- payment_records
- logistics
- invoices
- shares
- latest calculation snapshot
- status logs

---

### PATCH /api/formulas/:formulaId

Formula 기본정보 수정.

Version 생성 대상:

- quantity 변경
- exchange_rate 변경
- trade_type 변경
- item 변경

Audit만 생성:

- content/note 변경

---

## 2.2 Participant API

### POST /api/formulas/:formulaId/participants

Formula 참여자 추가.

필수 검증:

- sequence_order > 0
- Formula당 start_point 최대 1개
- Formula당 end_point 최대 1개
- quantity NOT NULL
- company_id 존재

Version 생성:

- 참여자 추가는 Formula Version 생성 대상

---

### PATCH /api/participants/:participantId

참여자 수정.

Version 생성 대상:

- buy_unit_price
- sell_unit_price
- quantity
- sequence_order
- role_group
- nature_group

Audit만 생성:

- memo 수정

---

## 2.3 Payment Schedule API

### POST /api/formulas/:formulaId/payment-schedules

예정 입출금 생성.

필드:

```text
participant_id
direction
payment_type
counterparty_company_id
scheduled_amount
scheduled_date
memo
```

검증:

- direction = IN 또는 OUT
- scheduled_amount > 0
- participant_id가 있으면 같은 formula 소속이어야 함
- counterparty_company_id 존재

---

## 2.4 Payment Record API

### POST /api/formulas/:formulaId/payment-records

실제 입출금 등록.

필드:

```text
payment_schedule_id
participant_id
direction
counterparty_company_id
actual_amount
actual_date
bank_name
account_name
account_no
confirmed_by
memo
```

검증:

- actual_amount > 0
- schedule_id가 있으면 schedule.formula_id = formula_id
- schedule_id가 있으면 record.direction = schedule.direction
- participant_id가 있으면 participant.formula_id = formula_id

---

### PATCH /api/payment-records/:recordId/complete

입출금 완료 처리.

처리:

- status = COMPLETED
- confirmed_at = now()
- confirmed_by 저장
- audit_logs 기록

---

### PATCH /api/payment-records/:recordId/cancel

입출금 완료 취소.

처리:

- is_canceled = TRUE
- canceled_at = now()
- cancel_reason 필수
- audit_logs 기록

주의:

- 물리 삭제 금지
- 취소된 레코드는 KPI에서 제외됨

---

## 2.5 Invoice API

### POST /api/formulas/:formulaId/invoices

계산서 등록.

필드:

```text
issuer_company_id
receiver_company_id
issuer_participant_id
receiver_participant_id
sequence_order
invoice_no
invoice_date
external_invoice_amount
supply_amount
tax_amount
status
memo
```

검증:

- issuer_company_id != receiver_company_id
- participant가 있으면 formula 소속 일치
- participant.company_id와 company_id 일치
- amount_verified는 사용자 입력 금지
- amount_verified는 DB 트리거 자동 계산

---

## 2.6 Logistics API

### POST /api/formulas/:formulaId/logistics

운송 등록.

필드:

```text
carrier_company_id
departure_company_id
arrival_company_id
cost_bearer_company_id
cost_type
total_logistics_cost
scheduled_date
memo
```

검증:

- 운송비가 있으면 cost_bearer_company_id 필수
- carrier_company_id는 운송 계산서 발행 주체
- departure/arrival company 존재

---

## 2.7 Share API

### POST /api/formulas/:formulaId/shares

셰어 등록.

필드:

```text
participant_id
target_company_id
share_basis
share_type
share_amount
share_rate
memo
```

검증:

- participant_id가 있으면 같은 formula 소속
- formula_shares가 Source of Truth

---

## 2.8 Formula Status API

### PATCH /api/formulas/:formulaId/status

Formula 상태 변경.

Request:

```json
{
  "target": "cash_in_status",
  "status": "COMPLETED",
  "reason": "입금 확인 완료"
}
```

target 허용값:

- trade_status
- cash_in_status
- cash_out_status
- invoice_status
- logistics_status
- delivery_status

처리:

```text
1. 기존 상태 확인
2. formulas 상태 업데이트
3. formula_status_logs INSERT
4. audit_logs INSERT
5. 종결 가능 여부 재계산
```

---

### PATCH /api/formulas/:formulaId/close

Formula 종결 처리.

조건:

- trade_status = COMPLETED
- cash_in_status = COMPLETED
- cash_out_status = COMPLETED
- invoice_status = AMOUNT_MATCHED
- logistics_status = COMPLETED
- delivery_status = COMPLETED

처리:

- is_closed = TRUE
- closed_at = now()
- audit_logs 기록

조건 불충족 시 400 반환.

---

## 2.9 KPI API

### GET /api/kpi/formulas/:formulaId

Formula KPI 조회.

Source:

- v_formula_confirmed_kpi
- v_formula_profit_engine
- v_formula_closeable
- v_formula_invoice_status

---

### GET /api/kpi/company/:companyId

회사 기준 KPI 조회.

Source:

- v_participant_confirmed_kpi

---

### GET /api/dashboard

대표 대시보드.

포함:

- 총 확정매출
- 총 확정출금
- 총 확정순이익
- 미수금
- 미지급금
- 종결 가능 Formula
- 미종결 Formula
- 계산서 불일치 Formula
- 최근 거래

---

## 2.10 Audit / Version API

### GET /api/formulas/:formulaId/versions

Formula 버전 조회.

### GET /api/formulas/:formulaId/snapshots

계산 스냅샷 조회.

### GET /api/audit-logs

감사 로그 조회.

---

# 3. 공통 응답 형식

성공:

```json
{
  "success": true,
  "data": {},
  "meta": {}
}
```

실패:

```json
{
  "success": false,
  "error": {
    "code": "TOCS_VALIDATION_ERROR",
    "message": "검증 오류",
    "details": []
  }
}
```

---

# 4. 주요 에러 코드 초안

```text
TOCS_VALIDATION_ERROR
TOCS_NOT_FOUND
TOCS_FORBIDDEN_STATE
TOCS_FORMULA_CLOSED
TOCS_PAYMENT_DIRECTION_MISMATCH
TOCS_PARTICIPANT_FORMULA_MISMATCH
TOCS_INVOICE_COMPANY_PARTICIPANT_MISMATCH
TOCS_CLOSE_CONDITION_NOT_MET
TOCS_DUPLICATE_SEQUENCE_ORDER
TOCS_DUPLICATE_START_POINT
TOCS_DUPLICATE_END_POINT
```

---

# 5. 트랜잭션 필수 API

아래 API는 반드시 DB 트랜잭션으로 처리한다.

- Formula 생성 + 초기 participant 생성
- participant 수정 중 Version 생성
- payment record complete/cancel
- invoice 수정
- status 변경
- Formula close
- Version 생성 + snapshot 생성 + audit log 생성

---

# 6. 다음 작업

API 설계는 초안 단계다.

TEST-004~006 통과 후 API 명세를 v1.0으로 확정한다.
