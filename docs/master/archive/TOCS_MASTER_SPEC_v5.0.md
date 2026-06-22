# TOCS_MASTER_SPEC_v5.0

## 0. 문서 목적

본 문서는 TOCS(Trading Operation Control System)의 최상위 기준 문서다.

v5.0은 PostgreSQL 실제 실행 검증 기준으로 TEST-001부터 TEST-006까지 통과한 상태를 반영한다.

---

# 1. 현재 검증 상태

## 1.1 DB 실행 검증

Docker PostgreSQL 16 기준으로 아래 항목을 실제 실행 검증했다.

- 15개 테이블 생성
- 6개 View 생성
- Trigger 생성
- Composite FK 생성
- Generated Column 생성
- Partial Index 생성
- amount_verified 보강 함수 적용
- TEST-001 PASS
- TEST-002 PASS
- TEST-003 PASS
- TEST-004 PASS
- TEST-005 PASS
- TEST-006 PASS

---

# 2. 검증 완료 테스트

## TEST-001 PASS

검증 항목:

- 기본 Formula 생성
- Participant 구조
- Payment Schedule / Record
- Invoice amount_verified
- Invoice mismatch
- Profit Engine
- Closeable Engine
- Participant KPI

발견 및 해결:

- amount_verified NULL 오류 발견
- sync_invoice_amount_verified() 함수 보강
- COALESCE(..., FALSE) 방어 적용

---

## TEST-002 PASS

검증 항목:

- 분할입금
- 부분출금
- 완료취소 후 재입금
- is_canceled = TRUE 레코드 KPI 제외
- 미수금
- 미지급금
- 입금률
- 출금률
- 확정순이익
- v_payment_unmatched

---

## TEST-003 PASS

검증 항목:

- 외상거래
- schedule 존재
- record 0건
- confirmed KPI 0 처리
- receivable/payable 전액 발생
- receive_rate/payment_rate = 0.00
- can_close = FALSE

---

## TEST-004 PASS

검증 항목:

- IMPORT 거래
- KRW/USD 환율 구조
- contract_exchange_rate 기준 계산
- adjusted_exchange_rate는 참고값으로 저장
- participant 단가는 V1 기준 KRW 환산값 저장
- 확정순이익과 예상순이익 분리

---

## TEST-005 PASS

검증 항목:

- formula_logistics
- carrier_company
- departure_company
- arrival_company
- cost_bearer_company
- SEPARATE_COST
- total_logistics_cost
- 운송비 출금 record가 confirmed_payment에 반영
- expected_cost와 logistics_cost 일치

---

## TEST-006 PASS

검증 항목:

- 6개 상태 완료
- can_close = TRUE
- is_closed = TRUE
- closed_at NOT NULL
- chk_closed_requires_all_completed 통과
- chk_closed_at_consistency 통과
- formula_status_logs 6건 기록
- audit_logs 1건 기록
- amount_verified TRUE 2건
- v_formula_closeable 종결 일관성 확인

---

# 3. TOCS 핵심 정책

## 3.1 Formula First

Formula는 TOCS의 최상위 원장이다.

Deal / Order / Project / Pipeline을 최상위 Entity로 만들지 않는다.

## 3.2 Formula 1개 = 품목 1개

V1 기준 Formula 하나에는 품목 하나만 연결한다.

## 3.3 확정 KPI

```text
확정매출 = 실제 은행 입금액
확정출금 = 실제 은행 출금액
확정순이익 = 실입금 - 실출금
```

## 3.4 예상 KPI

```text
예상순이익 = 총매출 - 총매입 - 비용 - 셰어
```

## 3.5 확정 / 예상 분리

확정 KPI와 예상 KPI는 절대 혼합하지 않는다.

## 3.6 입출금 완료취소

실제 입출금 레코드는 삭제하지 않는다.

취소 시:

```text
is_canceled = TRUE
canceled_at
cancel_reason
```

취소된 레코드는 KPI에서 제외된다.

## 3.7 Formula 종결

아래 6개 조건이 모두 충족되어야 종결 가능하다.

- trade_status = COMPLETED
- delivery_status = COMPLETED
- cash_in_status = COMPLETED
- cash_out_status = COMPLETED
- invoice_status = AMOUNT_MATCHED
- logistics_status = COMPLETED

---

# 4. 현재 발견된 개선 후보

아래 항목은 즉시 구조 변경하지 않는다.

DB 핵심 검증 완료 후 Backlog로 관리한다.

## P1 후보

- API 구현
- Prisma Schema 확정
- Formula Status API
- Formula Close API

## P2 후보

- formulas.invoice_status 자동 동기화
- Status Log 자동 생성
- Audit Log 자동 생성
- Share Engine 실제 검증

## P3 후보

- participant별 원통화 단가 컬럼
- 외화 원금액 보존 구조
- 환율 변동 손익
- 은행 API 연동
- 계산서 API 연동

---

# 5. 다음 검증 순서

## TEST-007

Share 배분 검증.

핵심:

- formula_shares
- 정액 Share
- 정률 Share
- Share가 expected_share에 반영되는지
- Share 지급 record가 confirmed_payment에 반영되는지

## TEST-008

종결 후 수정 차단 / Version 검증.

핵심:

- closed Formula 수정 제한
- 계산 영향 변경 시 formula_versions 생성
- formula_calculation_snapshots 생성
- audit_logs 기록

---

# 6. Git 상태

현재 기준 Git 체크포인트:

```text
main branch
tag: v4.8-db-verified
commit: TOCS v4.8 TEST-003 PASS
```

TEST-006 결과 반영 후 권장 태그:

```text
v5.0-core-lifecycle-verified
```
