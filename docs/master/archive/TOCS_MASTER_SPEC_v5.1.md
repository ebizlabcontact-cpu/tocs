# TOCS_MASTER_SPEC_v5.1

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

# 2. 최종 운영 파일 체계

기존 v1.5 / v1.6.1 다단계 SQL 체계는 폐기한다.

최종 운영 파일:

```text
db/schema/tocs_base_schema.sql
db/schema/tocs_supplement.sql
db/fixes/tocs_fix_amount_verified.sql
```

테스트 파일 체계:

```text
db/tests/test001/seed.sql
db/tests/test001/verify.sql
db/tests/test002/seed.sql
db/tests/test002/verify.sql
db/tests/test003/seed.sql
db/tests/test003/verify.sql
```

문서 체계:

```text
docs/master/TOCS_MASTER_SPEC.md
docs/master/archive/
docs/decisions/DECISION_LOG.md
docs/decisions/archive/
ai/prompts/
ai/archive/
```

---

# 3. Formula 핵심 원칙

Formula는 TOCS의 최상위 핵심 단위이자 운영 원장(Source of Truth)이다.

- Formula 1개 = 품목 1개
- Deal / Order / Project / Pipeline 최상위 Entity 생성 금지
- Company는 고정 역할을 갖지 않음
- 역할은 formula_participants에서 결정
- 모든 KPI와 상태는 Formula에서 파생

---

# 4. Formula Participants / 거래 라인 구조

Formula 내 A > B > C > D 구조는 `formula_participants` 라인 구조로 저장한다.

중요 규칙:

- `UNIQUE(formula_id, company_id)` 금지
- 동일 Company가 하나의 Formula 안에서 복수 역할 가능
- `UNIQUE(formula_id, sequence_order)` 유지
- `sequence_order > 0`
- Formula당 시작점 최대 1개
- Formula당 종료점 최대 1개
- 매입가 0 허용
- 매출가 0 허용
- `quantity`는 NOT NULL
- Formula.quantity와 participant.quantity는 다를 수 있음

---

# 5. 입출금 엔진

입출금은 아래 2단 구조를 사용한다.

```text
formula_payment_schedules = 예정 입출금
formula_payment_records = 실제 입출금 내역
```

입금/출금은 실무자가 실제 법인통장 입출금 내역 또는 대표이사 입출금 문자를 확인한 후 완료 처리한다.

자동 확정이 아니라 실무 확인 기반 버튼 처리 구조를 기본으로 한다.

완료취소:

```text
is_canceled = TRUE
canceled_at
cancel_reason
```

취소된 레코드는 확정 KPI에서 제외된다. TEST-002에서 검증 완료.

---

# 6. 계산 엔진

## 6.1 예상순이익

```text
예상순이익 = 총매출 - 총매입 - 비용 - 셰어
```

## 6.2 확정순이익

```text
확정순이익 = 실입금 - 실출금
```

비용과 셰어 중복 차감 금지.

## 6.3 확정 / 예상 분리

```text
확정 KPI = 실제 은행 입출금 기준
예상 KPI = Formula 기준
```

두 값은 절대 혼합하지 않는다.

---

# 7. 계산서 엔진

계산서는 거래 진행을 막는 락 장치가 아니라 Formula 종결 판단 장치다.

```text
계산서 없어도 거래 진행 가능
계산서 없어도 입출금 가능
계산서 없으면 Formula 종결 불가
```

계산서는 participant 기준으로 연결한다.

- issuer_participant_id
- receiver_participant_id
- issuer_company_id
- receiver_company_id

---

# 8. amount_verified 정책

`amount_verified`는 사용자 입력값이 아니라 시스템 자동 계산값이다.

`external_invoice_amount`와 `total_amount` 비교 결과로 산출한다.

실제 PostgreSQL 검증 중 `amount_verified` NULL 오류가 발견되었고, `sync_invoice_amount_verified()` 함수 보강으로 해결했다.

최종 함수 원칙:

```text
NEW.amount_verified는 절대 NULL이 되어서는 안 됨
비교 결과는 COALESCE(..., FALSE)로 방어
```

---

# 8.1 invoice_status 동기화 책임

`formulas.invoice_status`를 자동으로 갱신하는 DB Trigger는 존재하지 않는다.

`formula_invoices` 개별 계산서 상태는 `v_formula_invoice_status` View가
파생 계산(`derived_invoice_status`)한다.

`formulas.invoice_status` 컬럼 값을 실제로 갱신하는 책임은 API Layer에 있다.

API는 `v_formula_invoice_status`를 조회하여 그 결과를 `formulas.invoice_status`에
반영해야 한다.

---

# 8.2 Share Snapshot 동기화 책임

`formula_shares`는 셰어의 상세 원장(Source of Truth)이다.

`formula_calculation_snapshots.total_share`는 그 집계 스냅샷이다.

두 값은 DB 레벨에서 자동으로 동기화되지 않는다.

`formula_shares`가 변경되면, API Layer가 `formula_calculation_snapshots.total_share`를
재계산하여 갱신할 책임을 갖는다.

---

# 9. Formula 상태 관리

Formula 상태는 아래 6개로 분리한다.

- trade_status
- cash_in_status
- cash_out_status
- invoice_status
- logistics_status
- delivery_status

상태는 자동 완료 처리하지 않는다.

실무자가 확인 후 수동 완료 처리한다.

상태 변경 발생 시 트랜잭션 내 아래 3개를 함께 처리한다.

```text
formula_status_logs INSERT
audit_logs INSERT
formulas UPDATE
```

---

# 10. Formula 종결 규칙

아래 상태가 모두 완료일 때만 Formula는 종결될 수 있다.

- trade_status = COMPLETED
- cash_in_status = COMPLETED
- cash_out_status = COMPLETED
- invoice_status = AMOUNT_MATCHED
- logistics_status = COMPLETED
- delivery_status = COMPLETED

---

# 11. KPI 엔진

```text
확정매출 = 실제 은행 입금액
확정출금 = 실제 은행 출금액
확정순이익 = 실입금 - 실출금
미수금 = 입금예정금액 - 누적입금액
미지급금 = 출금예정금액 - 누적출금액
입금률 = 누적입금 / 입금예정금액
출금률 = 누적출금 / 출금예정금액
```

---

# 12. Formula 번호 체계

```text
FM-YYMM-NNNNN
```

월이 바뀌어도 순번은 리셋하지 않는다.
채번은 PostgreSQL Sequence 기반으로 처리한다.

formula_no는 항상 `DEFAULT generate_formula_no()`로 생성한다.

INSERT 시 formula_no를 직접 지정하지 않는다.

직접 지정 시 `formula_seq`가 증가하지 않아, 이후 자동 채번이 동일 번호에
도달하면 UNIQUE 제약 위반이 발생할 수 있다. TEST-008에서 이 위험이
실제로 식별되어 자동 채번 방식으로 통일했다.

---

# 13. DB MASTER DESIGN

핵심 테이블 15개:

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

핵심 View 6개:

1. v_formula_closeable
2. v_formula_confirmed_kpi
3. v_formula_invoice_status
4. v_formula_profit_engine
5. v_participant_confirmed_kpi
6. v_payment_unmatched

---

# 14. V1 보류 기능

아래 기능은 V1 핵심 구현에서 제외한다.

- 거래이슈 자동 감지 고도화
- 권한 구조 고도화
- 파일/증빙 고도화
- 은행 API 연동
- 환율 API 연동
- AI 리포트
- ERP 연동
- 거래처 포털

