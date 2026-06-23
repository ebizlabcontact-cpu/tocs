# TOCS_BACKLOG_v1.0

## 문서 목적

본 문서는 TOCS V1 범위에서 아직 해결되지 않은 항목과, TEST-001~008 진행
과정에서 해결이 완료된 항목을 구분하여 관리한다.

기준일: TEST-001~008 실제 PostgreSQL 실행 PASS 확정 시점.

---

## 1. Active Backlog (우선순위 재정렬)

### P1

- Formula Version Engine
  (단가/수량/참여자/운송비/환율/셰어 변경 시 Version + Snapshot + AuditLog
  동시 생성이 실제 PostgreSQL 환경에서 검증된 적이 없다. TEST-001~008 중
  formula_versions/formula_calculation_snapshots는 매 테스트마다 1회성
  초기값으로만 INSERT되었으며, 변경에 따른 신규 버전 생성 시나리오는
  다루지 않았다.)

- Formula Cancel Flow
  (trade_status, cash_in_status 등 각 상태의 CANCELED 값으로의 전이, 그리고
  Formula 자체의 취소 흐름은 TEST-001~008 어디에서도 다루지 않았다.)

### P2

- Snapshot Versioning
  (formula_versions.version_no가 2 이상으로 증가하는 시나리오, 그리고 이전
  버전 snapshot과 현재 snapshot을 비교 조회하는 시나리오는 검증되지 않았다.)

- Concurrency Test
  (동시 다발적 INSERT/UPDATE 상황에서 formula_seq 채번, payment_records
  분할입금 처리, formula_status_logs 동시 기록 등이 경합 조건에서 안전한지는
  검증되지 않았다.)

### P3

- External API / ERP Integration
- Bank Integration

(두 항목은 TOCS_MASTER_SPEC.md 17절 "V1 보류 기능"에 이미 명시되어 있으며,
이 문서에서는 우선순위 정보만 추가한다.)

---

## 2. Done (TEST-001~008에서 해결 완료)

아래 항목은 TEST-001~008 실행 결과로 실제 검증이 완료되어 Active Backlog에서
제거했다.

| 항목 | 해결 테스트 | 비고 |
|---|---|---|
| Payment Engine (분할입금/부분출금/완료취소 후 재입금/is_canceled 제외) | TEST-002 | |
| 외상거래(Credit) 상태 KPI 계산 | TEST-003 | |
| 수입/환율(IMPORT, contract_exchange_rate) 거래 | TEST-004 | |
| 물류비 4주체(carrier/departure/arrival/cost_bearer) 분리 | TEST-005 | |
| Formula 종결(CLOSE) 조건 및 CHECK Constraint | TEST-006 | |
| Share Engine (정액/정률 셰어, expected_share 반영) | TEST-007 | |
| 부분 계산서/부분 입금/부분 출금(PARTIAL 상태, Record 기준 계산) | TEST-008 | |
| amount_verified NULL 오류 | TEST-001 | sync_invoice_amount_verified() 함수 보강으로 해결 |
| formula_no 직접 지정 시 Sequence 불일치 위험 | TEST-008 | DEFAULT 자동 채번으로 통일 (DL-027) |

---

## 3. Archive

해당 없음. (현재까지 폐기되거나 범위에서 완전히 제외된 백로그 항목 없음.
17절 "V1 보류 기능" 8개 항목은 폐기가 아니라 V1 범위 제외 보류 상태이며,
P3로 일부가 이 문서의 Active Backlog에 다시 등재되어 있다.)
