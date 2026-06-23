# TOCS_TEST_SUMMARY_v1.0

## 문서 목적

TEST-001~008 실제 PostgreSQL 16 실행 결과를 기준으로 검증 범위와 결과를
요약한다. 모든 결과는 추측이 아니라 실제 실행 후 PASS 보고를 받은 내용만
기록한다.

---

## TEST-001 — Payment/Profit/Invoice Engine 기본 검증

목적: Formula 생성부터 입출금, 계산서, 확정/예상 순이익까지 기본 흐름 검증.

검증 범위:
- Formula, Participants 생성
- Payment Schedule / Record
- Invoice amount_verified
- Profit Engine, Closeable Engine, Participant KPI

결과: PASS

발견 및 해결: amount_verified NULL 오류 발견 → sync_invoice_amount_verified()
함수 보강으로 해결.

---

## TEST-002 — Payment Engine 예외 검증

목적: 분할입금, 부분출금, 입금완료취소 후 재입금 시나리오 검증.

검증 범위:
- 분할입금 / 부분출금
- 완료취소 후 재입금
- is_canceled = TRUE 레코드의 KPI 제외
- 미수금/미지급금/입금률/출금률/확정순이익
- v_payment_unmatched

결과: PASS (PASS/FAIL 자동 검증 9개 지표 전부 PASS)

---

## TEST-003 — 외상거래(Credit) 검증

목적: schedule만 존재하고 record가 없는 순수 외상 상태의 KPI 계산 검증.

검증 범위:
- confirmed_revenue/payment/net_profit = 0
- receivable/payable 전액 발생
- receive_rate/payment_rate = 0.00 (NULL 아님)
- can_close = FALSE

결과: PASS (PASS/FAIL 자동 검증 10개 지표 전부 PASS)

---

## TEST-004 — 수입/환율(IMPORT) 거래 검증

목적: 외화 거래의 KRW 환산 계산과 확정/예상 순이익 분리 검증.

검증 범위:
- trade_type = IMPORT, foreign_currency = USD
- contract_exchange_rate 적용 (adjusted_exchange_rate는 참고값으로만 저장)
- KRW 기준 예상매입/예상매출/예상순이익
- 확정순이익(1,300,000)과 예상순이익(1,000,000)의 분리

결과: PASS

---

## TEST-005 — 물류비/운송사/운송비 부담주체 검증

목적: 물류 4주체 분리와 운송비의 확정/예상 KPI 반영 검증.

검증 범위:
- carrier_company_id / departure_company_id / arrival_company_id /
  cost_bearer_company_id 분리
- 운송비 0보다 클 때 cost_bearer_company_id 필수 CHECK
- 운송비 지급 record의 confirmed_payment 반영
- 운송비의 expected_cost 반영
- logistics_status 미완료 시 can_close = FALSE

결과: PASS

---

## TEST-006 — Formula 종결(CLOSE) 검증

목적: 6개 상태 완료 시 종결 가능 여부와 종결 처리 자체의 정합성 검증.

검증 범위:
- 6개 상태(trade/delivery/cash_in/cash_out/invoice/logistics) 모두 충족 시
  can_close = TRUE
- is_closed = TRUE 업데이트의 CHECK Constraint 통과
- closed_at NOT NULL 저장
- formula_status_logs / audit_logs 동시 생성

결과: PASS

---

## TEST-007 — Share Engine 검증

목적: 정액/정률 셰어 등록과 예상/확정 순이익 반영 검증.

검증 범위:
- 정액 Share, 정률 Share(gross profit 기준) 등록
- expected_share의 v_formula_profit_engine 반영
- Share 지급 record의 confirmed_payment 반영
- formula_shares가 Share의 상세 원장임을 확인

결과: PASS

비고: 최초 Seed 작성 시 단일 INSERT 내 행별 컬럼 수 불일치로 실행 실패
(VALUES lists must all be the same length) → 컬럼 목록 통일로 수정 후 PASS.

---

## TEST-008 — 부분 계산서/부분 입금/부분 출금 검증

목적: 실무에서 가장 흔한 부분 처리 상태의 KPI 계산 검증.

검증 범위:
- cash_in_status = PARTIAL, cash_out_status = PARTIAL
- derived_invoice_status = ISSUED
- can_close = FALSE
- receivable/payable/receive_rate/payment_rate
- confirmed KPI와 expected KPI의 분리 계산
- PARTIAL 상태가 Schedule 기준이 아니라 Payment Record 기준으로 계산됨을
  v_formula_confirmed_kpi의 View 정의(pg_get_viewdef)로 직접 확인

결과: PASS

비고: 최초 Seed 작성 시 formula_no를 'FM-2606-00011'로 직접 지정 →
formula_seq 불일치로 향후 UNIQUE 충돌 위험 식별 → DEFAULT
generate_formula_no() 자동 채번으로 수정 후 PASS. (DL-027)

---

## 최종 결론

- Payment Engine 검증 완료
- Profit Engine 검증 완료
- Invoice Engine 검증 완료
- Logistics Engine 검증 완료
- Share Engine 검증 완료
- Close Engine 검증 완료
- Partial Status 검증 완료

## 현재 DB Layer 상태

API 개발 착수 가능.

## 남은 검증 영역

- Formula Version Engine (TOCS_BACKLOG_v1.0.md P1)
- Formula Cancel Flow (TOCS_BACKLOG_v1.0.md P1)
- Concurrency Test (TOCS_BACKLOG_v1.0.md P2)

## 검증 완료 범위

- Payment Engine
- Profit Engine
- Invoice Engine
- Logistics Engine
- Share Engine
- Close Engine
- Partial Status

---

## TEST-009 — Formula Version Engine 검증

결과: PASS

- Version 증가 검증
- Snapshot 보존 검증
- Audit Log 검증
- formula_no 유지 검증

---

## TEST-010 — Formula Cancel Flow 검증

결과: PASS

- 6개 상태 CANCELED 전환 검증
- status log 6건 검증
- audit log 검증
- 취소 Formula can_close=FALSE 검증
- is_closed=TRUE 취소 차단 CHECK 검증
