# TOCS_MASTER_SPEC_v4.7

## 0. 문서 목적

본 문서는 TOCS(Trading Operation Control System)의 최상위 기준 문서다.

TOCS의 모든 기획, 설계, 개발, AI 프롬프트, QA 검토는 본 문서를 기준으로 한다.

---

# 1. TOCS 핵심 정의

TOCS는 Formula First Architecture 기반의 Trading Operation Control System이다.

TOCS는 단순 거래관리, ERP, CRM, 그룹웨어가 아니다.

TOCS는 Formula를 중심으로 돈 흐름, 세무 흐름, 물류 흐름, 정산 흐름, 수익 흐름을 통제하는 현금흐름 중심 시스템이다.

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

모든 KPI와 경영지표는 Formula에서 파생된다.

---

# 2. Formula 정의

Formula는 TOCS의 최상위 핵심 단위이자 운영 원장(Source of Truth)이다.

Formula는 아래 흐름을 하나로 묶는다.

- 돈 흐름
- 세무 흐름
- 물류 흐름
- 정산 흐름
- 수익 흐름

Formula 구조 변경은 최고 수준 검토 대상이다.

---

# 3. Formula 기본 구조 원칙

## 3.1 Formula 1개 = 품목 1개

V1 기준 Formula 1개에는 품목 1개만 연결한다.

다품목 거래는 품목별 Formula를 별도로 생성한다.

V1에서는 `formula_items` 같은 다품목 하위 테이블을 생성하지 않는다.

## 3.2 Deal / Order 중심 구조 금지

TOCS는 Deal 중심 시스템이 아니다.

아래 Entity는 최상위 구조로 생성하지 않는다.

- Deal
- Order
- Project
- Pipeline
- Campaign

Formula가 원장이며 모든 하위 데이터는 Formula에 연결한다.

---

# 4. Company / Role 원칙

모든 참여자는 Company(Entity)로 관리한다.

Company 자체는 고정 역할을 갖지 않는다.

역할은 Formula 내부의 `formula_participants`에서 결정된다.

즉, 같은 회사가 Formula마다 Supplier, Buyer, Carrier, Financial, Other 등 서로 다른 역할을 가질 수 있다.

---

# 5. Formula Action Sheet v1

## 5.1 입력 순서

```text
품목
↓
매입처 / 매출처
↓
매입단가 / 매출단가
↓
수량
↓
입출금 설정
↓
운송 설정
↓
셰어 설정
↓
상태 관리
```

## 5.2 거래 구분

- 국내
- 수입
- 수출
- 혼합

국내 거래 선택 시 출발국가, 도착국가, 환율 관련 필드는 숨김 또는 비활성화한다.

## 5.3 환율 기준

수입/수출/혼합 거래의 환율은 기본적으로 계약시 환율을 기준으로 한다.

단, 환율 변동 가능성을 고려하여 수정환율, 변경사유, 변경이력을 저장한다.

---

# 6. Formula Participants / 거래 라인 구조

Formula 내 A > B > C > D 구조는 `formula_participants` 라인 구조로 저장한다.

`sequence_order`로 포뮬러 흐름을 표현한다.

중요 규칙:

- `UNIQUE(formula_id, company_id)` 금지
- 동일 Company가 하나의 Formula 안에서 복수 역할을 수행할 수 있음
- `UNIQUE(formula_id, sequence_order)` 유지
- `sequence_order > 0`
- Formula당 시작점 최대 1개
- Formula당 종료점 최대 1개
- 매입가 0 허용
- 매출가 0 허용
- 시작점은 매입가 0 가능
- 종료점은 매출가 0 가능
- `quantity`는 NOT NULL
- `Formula.quantity`와 `participant.quantity`는 다를 수 있음
- 수량 차이는 API에서 경고 및 검토 대상으로 처리

---

# 7. 입출금 엔진

TOCS KPI는 실제 은행 입출금 기준이다.

확정매출은 거래 생성 기준이나 계산서 기준이 아니라 실제 은행 입금액 기준으로 계산한다.

## 7.1 입출금 확인 방식

입금/출금은 실무자가 실제 법인통장 입출금 내역 또는 대표이사 입출금 문자를 확인한 후 완료 처리한다.

자동 확정이 아니라 실무 확인 기반 버튼 처리 구조를 기본으로 한다.

## 7.2 입출금 구조

입출금 구조는 단일, 분할, 부분, 선입금, 외상 등 필요한 모든 케이스를 처리할 수 있도록 설계한다.

DB 구조는 아래 2단 구조를 채택한다.

```text
formula_payment_schedules
= 예정 입출금

formula_payment_records
= 실제 입출금 내역
```

## 7.3 Formula 전체 기준 KPI

`formula_id`는 payment_records에서 NOT NULL이다.

payment_schedule_id, participant_id는 nullable 가능하다.

이유:

- 예정 없이 갑자기 입금되는 케이스 존재
- 입금 당시 어떤 schedule인지 모를 수 있음
- Formula에는 귀속되어야 KPI 집계 가능

## 7.4 미매칭 입출금

payment_schedule_id 또는 participant_id가 없는 레코드는 미매칭 입출금으로 관리한다.

미매칭 입출금은 Formula 전체 KPI에는 반영된다.

단, 회사 기준 KPI에는 정확히 반영되지 않을 수 있으므로 `v_payment_unmatched`로 추적한다.

## 7.5 은행계좌 필드

formula_payment_records는 은행계좌 정보를 구조화한다.

- bank_name
- account_name
- account_no
- bank_account_memo

V2에서는 bank_account_id, external_transaction_id, raw_bank_data를 검토한다.

---

# 8. 운송 엔진

실물 흐름과 세무 흐름은 다를 수 있다.

```text
세무 흐름:
A > B > C > D > E

실물 흐름:
A -----------------> E
```

## 8.1 운송 핵심 필드

- departure_company_id: 실제 출고 회사
- arrival_company_id: 실제 입고 회사
- carrier_company_id: 세금계산서를 발행한 운송사업체
- cost_bearer_company_id: 운송비 부담 주체
- cost_type: 매입가 포함 / 판매가 포함 / 별도 비용처리
- total_logistics_cost

운송비가 존재하면 cost_bearer_company_id는 필수다.

```text
운송비 지급 대상 = 세금계산서를 발행한 운송사업체
```

---

# 9. 계산서 엔진

계산서는 거래 진행을 막는 락 장치가 아니라, Formula 종결 판단 장치다.

```text
계산서 없어도 거래 진행 가능
계산서 없어도 입출금 가능
계산서 없으면 Formula 종결 불가
```

## 9.1 Participant 기준 연결

계산서는 회사 기준뿐 아니라 participant 기준으로 연결한다.

- issuer_participant_id
- receiver_participant_id
- issuer_company_id
- receiver_company_id

invoice participant와 company가 불일치하지 않도록 DB 트리거/API 검증을 적용한다.

## 9.2 계산서 상태

- NOT_ISSUED
- ISSUED
- RECEIVED
- AMOUNT_MATCHED
- AMOUNT_MISMATCHED
- CANCELED
- REVISION_REQUIRED

모든 계산서가 AMOUNT_MATCHED일 때만 Formula의 invoice_status가 AMOUNT_MATCHED가 될 수 있다.

## 9.3 external_invoice_amount

`external_invoice_amount`는 외부 계산서 원본 표시 금액이다.

`total_amount`는 supply_amount + tax_amount로 계산된 시스템 금액이다.

검증 원칙:

```text
external_invoice_amount = total_amount
→ amount_verified = TRUE

external_invoice_amount ≠ total_amount
→ amount_verified = FALSE
```

invoice_status 전환은 API 레이어에서 담당한다.

---

# 10. 셰어 엔진

셰어의 Source of Truth는 `formula_shares`다.

`formula_participants.share_amount`는 사용하지 않는다.

셰어는 거래마다 케이스바이케이스이며, 직접입력과 차등배분을 우선 지원한다.

셰어 방식 우선순위:

1. 직접입력
2. 정액
3. 정률
4. N분배

formula_shares는 participant 복합 FK를 통해 동일 Formula 소속 participant인지 보장한다.

---

# 11. 계산 엔진

## 11.1 예상순이익

```text
예상순이익 = 총매출 - 총매입 - 비용 - 셰어
```

예상순이익은 Formula 기준이며, `formula_calculation_snapshots` 최신 레코드를 기준으로 한다.

## 11.2 확정순이익

```text
확정순이익 = 실입금 - 실출금
```

실출금에는 매입지급, 운송비지급, 셰어지급, 기타직접비가 모두 포함된다.

따라서 확정순이익 계산 시 비용과 셰어를 별도 차감하지 않는다.

중복 차감 금지.

## 11.3 확정/예상 분리

```text
확정 KPI = 실제 은행 입출금 기준
예상 KPI = Formula 기준
```

두 값은 절대 혼합하지 않는다.

---

# 12. Formula 상태 관리

Formula는 단일 상태만으로 판단하지 않는다.

개별 상태:

- trade_status
- cash_in_status
- cash_out_status
- invoice_status
- logistics_status
- delivery_status

상태는 자동 완료 처리하지 않는다.

실무자가 확인 후 수동 완료 처리한다.

시스템은 종결 가능 여부만 판단한다.

상태 변경 발생 시 트랜잭션 내 아래 3개를 함께 처리한다.

```text
formula_status_logs INSERT
audit_logs INSERT
formulas UPDATE
```

---

# 13. Formula 종결 규칙

아래 상태가 모두 완료일 때만 Formula는 종결될 수 있다.

- trade_status = COMPLETED
- cash_in_status = COMPLETED
- cash_out_status = COMPLETED
- invoice_status = AMOUNT_MATCHED
- logistics_status = COMPLETED
- delivery_status = COMPLETED

하나라도 미완료이면 종결할 수 없다.

is_closed와 closed_at 정합성을 보장한다.

```text
is_closed = TRUE → closed_at NOT NULL
is_closed = FALSE → closed_at NULL
```

---

# 14. Formula Version / Audit Log 구분

## 14.1 Formula Version

Formula 내부 변경 이력이다.

대상:

- 단가 변경
- 수량 변경
- 참여자 변경
- 운송비 변경
- 환율 변경
- 셰어 변경
- 계산 결과 스냅샷

Version 생성 시:

```text
formula_versions INSERT
formula_calculation_snapshots INSERT
audit_logs INSERT
```

트랜잭션으로 동시 처리한다.

## 14.2 Audit Log

포뮬러 외 시스템 전체 변경 감사 로그다.

상태변경도 audit_logs에 함께 남긴다.

---

# 15. KPI 엔진

## 15.1 확정매출

```text
확정매출 = 실제 은행 입금액
```

## 15.2 확정출금

```text
확정출금 = 실제 은행 출금액
```

## 15.3 확정순이익

```text
확정순이익 = 실입금 - 실출금
```

## 15.4 미수금

```text
미수금 = 입금예정금액 - 누적입금액
```

## 15.5 미지급금

```text
미지급금 = 출금예정금액 - 누적출금액
```

## 15.6 입금률 / 출금률

```text
입금률 = 누적입금 / 입금예정금액
출금률 = 누적출금 / 출금예정금액
```

## 15.7 회사 필터 기준 KPI

대시보드는 특정 회사 고정이 아니라, 보고 싶은 회사를 필터로 선택해 해당 회사 기준 데이터를 볼 수 있어야 한다.

선택 회사 기준:

- 매입
- 매출
- 실입금
- 실출금
- 미수금
- 미지급금
- 순이익
- 거래현황

이를 위해 participant/company 기준 KPI View를 사용한다.

---

# 16. Formula 번호 체계

Formula 번호는 아래 형식을 사용한다.

```text
FM-YYMM-NNNNN
```

예시:

```text
FM-2606-00001
```

- FM = Formula Management
- YYMM = 생성 연월
- NNNNN = PostgreSQL Sequence 기반 전역 증가 순번

월이 바뀌어도 순번은 리셋하지 않는다.

채번은 PostgreSQL Sequence로 처리한다.

---

# 17. PostgreSQL / Prisma 운영 원칙

PostgreSQL Schema를 Source of Truth로 본다.

Prisma는 애플리케이션 ORM 매핑 도구로 사용한다.

Generated Column, Trigger, View, Partial Index, Sequence, 고급 Constraint는 PostgreSQL migration supplement에서 관리한다.

v1.6 supplement는 사용하지 않는다.

v1.6.1 supplement 단일 파일을 사용한다.

적용 순서:

```text
1. v1.5 schema 적용
2. v1.5 supplement 적용
3. v1.6.1 supplement 적용
4. Prisma schema 반영
5. prisma generate
```

---

# 18. DB MASTER DESIGN v1.6.1

## 18.1 핵심 테이블 15개

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

## 18.2 핵심 View

- v_formula_confirmed_kpi
- v_formula_profit_engine
- v_formula_invoice_status
- v_payment_unmatched
- v_formula_closeable
- participant/company 기준 KPI View

## 18.3 DB 검증 원칙

```text
CHECK Constraint
= 같은 테이블 내 컬럼 간 불변 규칙

복합 FK
= 테이블 간 formula_id 소속 일치

Trigger
= 테이블 간 의미적 일치 및 파생값 자동 계산

API Layer
= 비즈니스 판단 영역
```

---

# 19. V1 보류 기능

아래 기능은 V1 핵심 구현에서 제외한다.

- 거래이슈 자동 감지 고도화
- 권한 구조 고도화
- 파일/증빙 고도화
- 은행 API 연동
- 환율 API 연동
- AI 리포트
- ERP 연동
- 거래처 포털

---

# 20. 개발 체계

- ChatGPT: 기획, QA, 구조 검토
- Claude: DB, 계산엔진, 비즈니스 로직 설계
- v0: UI 프로토타입
- Cursor: 실제 구현
- Vercel: 배포 및 프리뷰
- Codex: 보조 코딩

개발 흐름:

```text
TOCS_MASTER_SPEC
↓
Claude 설계
↓
ChatGPT 검토
↓
Prisma / PostgreSQL Schema 확정
↓
API 설계
↓
v0 UI 설계
↓
Cursor 구현
↓
Vercel Preview
↓
QA
```

---

# 21. 현재 단계

TOCS DB Schema v1.6.1은 최종 확정 가능 수준이다.

다음 단계는 API 설계다.
