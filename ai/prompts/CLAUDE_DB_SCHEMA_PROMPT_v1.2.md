# CLAUDE_DB_SCHEMA_PROMPT_v1.2

## 목적

Claude는 본 문서를 기준으로 TOCS DB/API 설계 후속 작업을 수행한다.

DB Schema는 v1.6.1 기준으로 최종 확정 가능 수준이다.

새로운 Entity 추가를 제안하지 말고, API 설계와 구현 검토는 아래 확정 구조를 기준으로 진행한다.

---

# 1. 절대 준수 원칙

- Formula First Architecture
- Formula = Source of Truth
- Formula 1개 = 품목 1개
- Deal / Order Entity 생성 금지
- Company 고정 역할 금지
- 역할은 formula_participants에서 결정
- 확정 KPI는 실제 은행 입출금 기준
- 예상 KPI와 확정 KPI 혼합 금지
- 상태 자동 완료 금지
- 계산서는 거래 진행 조건이 아니라 종결 조건
- PostgreSQL Schema = Source of Truth
- Prisma = ORM 매핑 도구

---

# 2. DB Schema 기준

TOCS DB Schema v1.6.1을 기준으로 한다.

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

---

# 3. Formula 상태 기준

Formula 상태는 아래 6개로 분리한다.

- trade_status
- cash_in_status
- cash_out_status
- invoice_status
- logistics_status
- delivery_status

상태는 수동 완료 처리한다.

시스템은 종결 가능 여부만 판단한다.

---

# 4. Formula 종결 조건

아래 상태가 모두 충족되어야 Formula 종결 가능하다.

- trade_status = COMPLETED
- cash_in_status = COMPLETED
- cash_out_status = COMPLETED
- invoice_status = AMOUNT_MATCHED
- logistics_status = COMPLETED
- delivery_status = COMPLETED

---

# 5. 입출금 기준

입출금은 아래 2단 구조를 사용한다.

```text
formula_payment_schedules = 예정 입출금
formula_payment_records = 실제 입출금 내역
```

formula_payment_records에서 formula_id는 NOT NULL이다.

payment_schedule_id와 participant_id는 nullable 허용한다.

미매칭 입출금은 `v_payment_unmatched`로 추적한다.

---

# 6. Profit Engine

확정순이익:

```text
확정순이익 = 실입금 - 실출금
```

예상순이익:

```text
예상순이익 = 총매출 - 총매입 - 비용 - 셰어
```

확정 KPI와 예상 KPI를 혼합하지 않는다.

---

# 7. Invoice Engine

계산서는 participant 기준으로 연결한다.

- issuer_participant_id
- receiver_participant_id
- issuer_company_id
- receiver_company_id

external_invoice_amount는 외부 계산서 원본 표시 금액이다.

total_amount는 supply_amount + tax_amount이다.

amount_verified는 트리거로 자동 계산한다.

invoice_status 전환은 API 레이어에서 담당한다.

---

# 8. API 설계 요청 시 산출물 형식

Claude는 API 설계 시 아래를 포함한다.

1. API 목록
2. 요청/응답 타입
3. 트랜잭션 범위
4. DB View 사용 여부
5. 상태 변경 시 status_log + audit_log 처리
6. Formula Version 생성 여부
7. 오류 케이스
8. API 테스트 시나리오

---

# 9. 금지사항

- 새로운 최상위 Entity 추가 금지
- Formula 구조 변경 금지
- 상태 자동 완료 로직 금지
- 확정순이익에 비용/셰어 중복 차감 금지
- 계산서 미등록 시 거래 진행 자체를 막는 구조 금지
- V1 보류 기능 추가 금지
