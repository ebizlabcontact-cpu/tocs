# CLAUDE_DB_SCHEMA_PROMPT_v1.1

## 목적
Claude는 본 문서를 기준으로 TOCS DB Schema 초안을 설계한다. 이 문서는 최종 구현 코드가 아니라 TOCS의 핵심 철학과 DB 설계 원칙을 훼손하지 않기 위한 설계 지시서다.

## 절대 준수 원칙
- Formula First Architecture
- Formula는 돈/세무/물류/정산/수익 흐름을 묶은 운영 원장
- Deal, Order, Project, Pipeline, Campaign 생성 금지
- Formula 1개 = 품목 1개
- `formula_items` 생성 금지
- Company 고정 역할 금지
- 역할은 `formula_participants`에서 결정
- 상태 자동 완료 금지
- 시스템은 종결 가능 여부만 판단

## 핵심 테이블 설계 대상
1. companies
2. company_contacts
3. items
4. formulas
5. formula_participants
6. formula_payment_schedules
7. formula_payment_records
8. formula_logistics
9. formula_logistics_vehicles
10. formula_invoices
11. formula_shares
12. formula_versions
13. formula_calculation_snapshots
14. formula_status_logs
15. audit_logs

## 입출금 구조
기존 `formula_payments` 단일 테이블 대신 아래 2단 구조를 설계한다.

```text
formula_payment_schedules = 예정 입출금
formula_payment_records = 실제 입출금 내역
```

### formula_payment_schedules 필드 예시
```text
id
formula_id
participant_id
direction
payment_type
counterparty_company_id
scheduled_amount
scheduled_date
status
memo
created_at
updated_at
```

### formula_payment_records 필드 예시
```text
id
formula_id
payment_schedule_id
participant_id
direction
counterparty_company_id
actual_amount
actual_date
bank_account
confirmed_by
confirmed_at
status
is_canceled
canceled_at
cancel_reason
memo
created_at
updated_at
```

중요 규칙:
- 실제 은행 입출금 기준
- 다건 입금/출금 허용
- 부분입금/분할입금 허용
- 완료취소 가능
- 삭제 금지, 취소 상태 보존

자동 산출값:
```text
누적입금 = IN actual_amount 합계
누적출금 = OUT actual_amount 합계
미수금 = IN scheduled_amount 합계 - 누적입금
미지급금 = OUT scheduled_amount 합계 - 누적출금
입금률 = 누적입금 / IN scheduled_amount 합계
출금률 = 누적출금 / OUT scheduled_amount 합계
```

## formulas
필드 예시:
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

상태 필드는 수동 처리 결과를 저장한다. 자동으로 상태 완료 처리하지 않는다.

## formula_participants
A > B > C > D 구조를 저장하는 핵심 라인이다.

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

매입가 0, 매출가 0 허용. sequence_order로 흐름 표현.

## formula_logistics
운송비 지급 대상은 세금계산서를 발행한 운송사업체다.

```text
carrier_company_id = 세금계산서를 발행한 운송사업체
운송비 지급 대상 = 세금계산서를 발행한 운송사업체
```

운송비 처리 유형: INCLUDED_IN_BUY_PRICE, INCLUDED_IN_SELL_PRICE, SEPARATE_COST.

## formula_invoices
계산서는 거래 진행 조건이 아니라 종결 조건이다.

```text
계산서 없어도 거래 진행 가능
계산서 없어도 입출금 가능
계산서 없으면 Formula 종결 불가
```

invoice_status 예시:
```text
NOT_ISSUED
ISSUED
RECEIVED
AMOUNT_MATCHED
AMOUNT_MISMATCHED
CANCELED
REVISION_REQUIRED
```

## formula_versions / audit_logs 구분
formula_versions = Formula 내부 변경 이력.  
audit_logs = 포뮬러 외 시스템 전체 변경 감사 로그.

## KPI 계산 원칙
```text
확정매출 = 실제 은행 입금액
확정출금 = 실제 은행 출금액
확정순이익 = 실입금 - 실출금 - 실제비용 - 실제셰어
미수금 = 입금예정금액 - 누적입금액
미지급금 = 출금예정금액 - 누적출금액
```

예상 KPI는 Formula 기준으로 별도 관리한다.

## 회사 필터 기반 조회
기본 관리 주체는 주식회사 지오웍스다. 단, DB를 특정 회사 중심으로 고정하지 않는다. 대시보드는 회사 필터로 원하는 회사를 선택해 해당 회사 기준 매입/매출/미수/미지급/순이익을 조회할 수 있어야 한다.

## V1 보류 기능
거래이슈 자동 감지 고도화, 권한 구조 고도화, 파일/증빙 고도화, 은행 API 연동, 환율 API 연동, AI 리포트, ERP 연동, 거래처 포털은 V1 핵심 구현에서 제외한다.

## Claude 산출물 요청
1. PostgreSQL DB Schema 초안
2. Prisma Schema 초안
3. 주요 테이블 관계 설명
4. 각 테이블별 설계 의도
5. 인덱스 추천
6. 데이터 정합성 제약조건
7. Formula 종결 조건 계산 로직 초안
8. KPI 집계 쿼리 초안
9. 향후 확장 시 주의사항
