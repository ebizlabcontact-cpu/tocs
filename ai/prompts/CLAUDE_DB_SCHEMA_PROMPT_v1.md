# CLAUDE_DB_SCHEMA_PROMPT_v1

## 목적

Claude는 본 문서를 기준으로 TOCS(Trading Operation Control System)의 DB Schema 초안을 설계한다.

이 문서는 최종 구현 코드가 아니라, TOCS의 핵심 철학과 DB 설계 원칙을 훼손하지 않기 위한 설계 지시서다.

---

# 1. 절대 준수 원칙

## 1.1 Formula First Architecture

TOCS의 최상위 핵심 단위는 Formula다.

Formula는 단순 거래가 아니라 아래 흐름을 하나로 묶은 운영 원장(Source of Truth)이다.

- 돈 흐름
- 세무 흐름
- 물류 흐름
- 정산 흐름
- 수익 흐름

모든 KPI와 경영지표는 Formula에서 파생된다.

```text
Formula
↓
Derived Data
↓
Accumulated / Aggregated Data
↓
Dashboard
↓
KPI / Management Indicators
```

## 1.2 Deal Entity 생성 금지

TOCS는 Deal 중심 시스템이 아니다.

아래와 같은 별도 최상위 Entity를 생성하지 않는다.

- Deal
- Order
- Project
- Pipeline
- Campaign

Formula가 원장이며, 모든 하위 데이터는 Formula에 연결한다.

## 1.3 Formula 1개 = 품목 1개

V1 기준 Formula 1개에는 품목 1개만 연결한다.

따라서 다품목 하위 테이블인 `formula_items`는 생성하지 않는다.

필요 시 다품목 거래는 품목별 Formula를 별도 생성한다.

---

# 2. 핵심 테이블 설계 대상

Claude는 아래 테이블을 기준으로 DB Schema를 설계한다.

1. companies
2. company_contacts
3. items
4. formulas
5. formula_participants
6. formula_payments
7. formula_logistics
8. formula_logistics_vehicles
9. formula_invoices
10. formula_shares
11. formula_versions
12. formula_calculation_snapshots
13. formula_status_logs
14. audit_logs

---

# 3. companies

회사/거래처 마스터다.

모든 참여자는 Company로 관리한다.

Company 자체는 고정 역할을 갖지 않는다.

역할은 Formula 내부의 `formula_participants`에서 결정된다.

필드 예시:

```text
id
company_name
business_number
ceo_name
main_phone
head_office_address
branch_address
logistics_address
nature_group
default_payment_group
is_active
created_at
updated_at
```

---

# 4. company_contacts

회사 담당자 정보다.

```text
id
company_id
contact_name
position
phone
email
memo
is_primary
created_at
updated_at
```

FK:

```text
company_contacts.company_id → companies.id
```

---

# 5. items

품목 마스터다.

```text
id
item_name
item_code
default_unit
tax_type
standard_checklist
memo
is_active
created_at
updated_at
```

---

# 6. formulas

Formula 원장 헤더 테이블이다.

Formula 1개는 품목 1개만 가진다.

```text
id
formula_no
trade_type
item_id
unit
quantity
base_currency
foreign_currency
departure_country
arrival_country
contract_exchange_rate
adjusted_exchange_rate
trade_status
receive_status
payment_status
invoice_status
logistics_status
is_closed
closed_at
created_by
created_at
updated_at
```

FK:

```text
formulas.item_id → items.id
```

trade_type 예시:

```text
DOMESTIC
IMPORT
EXPORT
MIXED
```

주의:

국내 거래일 경우 국가/환율 관련 필드는 UI에서 숨김 또는 비활성화한다.

---

# 7. formula_participants

Formula 내 A > B > C > D 구조를 저장하는 핵심 라인 테이블이다.

`sequence_order`로 포뮬러 흐름을 표현한다.

```text
id
formula_id
company_id
sequence_order
role_group
nature_group
payment_group
buy_unit_price
sell_unit_price
quantity
total_buy_amount
total_sell_amount
direct_cost_amount
share_amount
profit_amount
profit_rate
is_start_point
is_end_point
memo
created_at
updated_at
```

FK:

```text
formula_participants.formula_id → formulas.id
formula_participants.company_id → companies.id
```

중요 규칙:

- 매입가 0 허용
- 매출가 0 허용
- 시작점은 매입가 0 가능
- 종료점은 매출가 0 가능
- Company는 고정 역할을 갖지 않고 Formula 내부에서 역할이 결정됨

예시:

```text
1 CJ제일제당: buy 0 / sell 710
2 지오웍스: buy 710 / sell 1010
3 네이처인사이트: buy 1010 / sell 1200
4 에코앤리사이클: buy 1200 / sell 0
```

---

# 8. formula_payments

입금/출금 실제 내역 테이블이다.

TOCS KPI는 실제 은행 입출금 기준이다.

확정매출 = 실제 은행 입금액  
확정순이익 = 실입금 - 실출금 - 실제비용 - 실제셰어

```text
id
formula_id
participant_id
direction
payment_type
counterparty_company_id
expected_amount
actual_amount
expected_date
actual_date
status
is_canceled
canceled_at
cancel_reason
memo
created_at
updated_at
```

FK:

```text
formula_payments.formula_id → formulas.id
formula_payments.participant_id → formula_participants.id
formula_payments.counterparty_company_id → companies.id
```

direction:

```text
IN
OUT
```

payment_type:

```text
PREPAID
CREDIT
INSTALLMENT
PARTIAL
OTHER
```

status:

```text
PENDING
PARTIAL
COMPLETED
CANCELED
```

중요 규칙:

- 다건 입금/출금 허용
- 부분입금/분할입금 허용
- 완료취소 가능
- 삭제 금지, 취소 상태로 이력 보존
- 미수금 = 입금예정금액 - 누적입금액
- 미지급금 = 출금예정금액 - 누적출금액

---

# 9. formula_logistics

운송 헤더 테이블이다.

TOCS에서는 세무 흐름과 실물 흐름이 다를 수 있다.

```text
세무 흐름: A > B > C > D
실물 흐름: A -------------> D
```

```text
id
formula_id
departure_company_id
arrival_company_id
carrier_company_id
cost_bearer_company_id
cost_include_type
item_id
quantity
vehicle_count
total_logistics_cost
scheduled_dispatch_date
scheduled_delivery_date
actual_dispatch_date
actual_delivery_date
logistics_status
settlement_status
memo
created_at
updated_at
```

FK:

```text
formula_logistics.formula_id → formulas.id
formula_logistics.departure_company_id → companies.id
formula_logistics.arrival_company_id → companies.id
formula_logistics.carrier_company_id → companies.id
formula_logistics.cost_bearer_company_id → companies.id
formula_logistics.item_id → items.id
```

중요 원칙:

```text
carrier_company_id = 세금계산서를 발행한 운송사업체
운송비 지급 대상 = 세금계산서를 발행한 운송사업체
```

cost_include_type:

```text
INCLUDED_IN_BUY_PRICE
INCLUDED_IN_SELL_PRICE
SEPARATE_COST
```

---

# 10. formula_logistics_vehicles

차량별 운송 정보다.

```text
id
logistics_id
vehicle_no
driver_name
driver_phone
vehicle_cost
dispatch_status
settlement_status
completed_at
paid_at
memo
created_at
updated_at
```

FK:

```text
formula_logistics_vehicles.logistics_id → formula_logistics.id
```

---

# 11. formula_invoices

세금계산서 흐름 테이블이다.

계산서는 거래 진행을 막는 락 장치가 아니라, 종결 판단 장치다.

```text
계산서 없어도 거래 진행 가능
계산서 없어도 입출금 가능
계산서 없으면 종결 불가
```

```text
id
formula_id
seller_participant_id
buyer_participant_id
seller_company_id
buyer_company_id
invoice_category
invoice_status
supply_amount
vat_amount
total_amount
issued_date
received_date
invoice_no
file_url
memo
created_at
updated_at
```

FK:

```text
formula_invoices.formula_id → formulas.id
formula_invoices.seller_participant_id → formula_participants.id
formula_invoices.buyer_participant_id → formula_participants.id
formula_invoices.seller_company_id → companies.id
formula_invoices.buyer_company_id → companies.id
```

invoice_category:

```text
TRADE
LOGISTICS
SHARE
OTHER
```

invoice_status:

```text
NOT_ISSUED
ISSUED
RECEIVED
CANCELED
```

계산서 라인은 Formula 참여자 순서 기준으로 자동 생성 가능하다.

예:

```text
A > B > C > D

자동 계산서 라인:
A → B
B → C
C → D
```

---

# 12. formula_shares

셰어/수익배분 테이블이다.

셰어는 거래마다 케이스바이케이스다.

직접입력과 차등배분을 우선 지원해야 한다.

```text
id
formula_id
participant_id
share_basis
share_method
recipient_company_id
recipient_person_name
recipient_phone
share_quantity
share_rate
share_amount
status
paid_at
memo
created_at
updated_at
```

FK:

```text
formula_shares.formula_id → formulas.id
formula_shares.participant_id → formula_participants.id
formula_shares.recipient_company_id → companies.id
```

share_basis:

```text
SALES
PROFIT
FIXED_AMOUNT
DIRECT_INPUT
```

share_method 우선순위:

```text
DIRECT
FIXED_AMOUNT
FIXED_RATE
N_SPLIT
```

---

# 13. formula_versions

Formula 변경 이력 테이블이다.

Formula 진행 중 변수나 변경사항이 발생하면 신규 버전 또는 스냅샷을 생성한다.

주요 변경 사유:

1. 입금 지연
2. 출금 지연
3. 단가 변경
4. 수량 변경
5. 바이어 변경
6. 운송 지연
7. 운송비 변경

```text
id
formula_id
version_no
change_reason
changed_by
changed_at
snapshot_json
```

FK:

```text
formula_versions.formula_id → formulas.id
```

---

# 14. formula_calculation_snapshots

계산 결과 스냅샷 테이블이다.

Formula 수정 또는 신규 버전 생성 시 계산 결과 스냅샷을 저장해야 한다.

목적:

- 과거 데이터 훼손 방지
- 버전별 수익 비교
- 정산 근거 보존
- 세무 증빙 보존

```text
id
formula_id
version_id
calculated_at
calculation_version
applied_exchange_rate
total_buy_amount
total_sell_amount
total_cost_amount
total_share_amount
expected_profit
confirmed_profit
expected_receivable
actual_received
remaining_receivable
expected_payable
actual_paid
remaining_payable
snapshot_json
created_at
```

FK:

```text
formula_calculation_snapshots.formula_id → formulas.id
formula_calculation_snapshots.version_id → formula_versions.id
```

---

# 15. formula_status_logs

상태 변경 이력 테이블이다.

TOCS는 단일 상태를 사용하지 않는다.

개별 상태:

- 거래상태
- 입금상태
- 출금상태
- 계산서상태
- 운송상태

종결 여부는 별도 관리한다.

모든 상태가 완료일 때만 Formula 종결 가능하다.

```text
id
formula_id
status_type
old_status
new_status
changed_by
changed_at
reason
```

FK:

```text
formula_status_logs.formula_id → formulas.id
```

status_type:

```text
TRADE_STATUS
RECEIVE_STATUS
PAYMENT_STATUS
INVOICE_STATUS
LOGISTICS_STATUS
```

중요 규칙:

- 상태 수정 가능
- 완료취소 가능
- 모든 변경 이력 저장
- 하나라도 미완료면 Formula 종결 불가

---

# 16. audit_logs

전체 변경 감사 로그다.

```text
id
entity_type
entity_id
action
old_value_json
new_value_json
changed_by
changed_at
ip_address
memo
```

필수 기록 대상:

- 단가 변경
- 수량 변경
- 입금완료
- 입금완료취소
- 출금완료
- 출금완료취소
- 운송비 변경
- 셰어 변경
- 상태 변경
- 환율 변경

---

# 17. KPI 계산 원칙

TOCS KPI는 현금흐름 중심이다.

## 17.1 확정매출

```text
확정매출 = 실제 은행 입금액
```

## 17.2 확정출금

```text
확정출금 = 실제 은행 출금액
```

## 17.3 확정순이익

```text
확정순이익 = 실입금 - 실출금 - 실제비용 - 실제셰어
```

## 17.4 미수금

```text
미수금 = 입금예정금액 - 누적입금액
```

## 17.5 미지급금

```text
미지급금 = 출금예정금액 - 누적출금액
```

## 17.6 예상 KPI

예상 KPI는 Formula 기준으로 별도 관리한다.

확정 KPI와 예상 KPI를 혼합하지 않는다.

---

# 18. 출력 요청

Claude는 위 요구사항을 기준으로 아래 산출물을 작성한다.

1. PostgreSQL 기준 DB Schema 초안
2. Prisma Schema 초안
3. 주요 테이블 관계 설명
4. 각 테이블별 설계 의도
5. 인덱스 추천
6. 데이터 정합성 제약조건
7. Formula 종결 조건을 위한 계산 로직 초안
8. KPI 집계 쿼리 초안
9. 향후 확장 시 주의사항

---

# 19. 금지사항

Claude는 아래 작업을 하지 않는다.

- Deal Entity 생성 금지
- Order Entity 생성 금지
- Formula 1개에 다품목 구조 생성 금지
- Company에 고정 역할 부여 금지
- 계산서 미등록 시 거래 진행 자체를 막는 구조 금지
- 상태를 단일 status 하나로 압축 금지
- 입출금 완료취소 이력 삭제 금지
- 운송비 지급 대상을 계산서 발행 사업체와 분리 금지
