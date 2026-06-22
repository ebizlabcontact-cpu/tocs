# DECISION_LOG_v1.8

## 2026-06-18

### DL-001. Formula First Architecture 확정

TOCS는 Formula 중심 시스템으로 설계한다.

모든 KPI와 경영지표는 Formula에서 파생된다.

---

### DL-002. Formula 정의 확정

Formula는 돈 흐름, 세무 흐름, 물류 흐름, 정산 흐름, 수익 흐름을 하나로 묶은 운영 원장이다.

---

### DL-003. Formula 1개 = 품목 1개 확정

V1 기준 Formula 1개에는 품목 1개만 연결한다.

다품목 거래는 품목별 Formula를 별도 생성한다.

---

### DL-004. Deal / Order Entity 생성 금지

TOCS는 Deal 중심 시스템이 아니다.

Deal, Order, Project, Pipeline 등 별도 최상위 Entity를 생성하지 않는다.

---

### DL-005. Company / Role 분리 확정

모든 참여자는 Company로 관리한다.

Company 자체는 고정 역할을 갖지 않는다.

역할은 Formula 내부에서 결정한다.

---

### DL-006. Formula Participants 라인 구조 확정

A > B > C > D 구조는 `formula_participants`와 `sequence_order`로 표현한다.

`UNIQUE(formula_id, company_id)`는 사용하지 않는다.

동일 Company가 하나의 Formula 안에서 복수 역할을 수행할 수 있다.

---

### DL-007. Formula Participants 정합성 강화

- quantity NOT NULL
- sequence_order > 0
- Formula당 시작점 최대 1개
- Formula당 종료점 최대 1개
- participant 복합 FK 참조를 위한 UNIQUE(id, formula_id) 적용

---

### DL-008. Formula.quantity와 Participant.quantity 정책 확정

Formula.quantity와 participant.quantity는 다를 수 있음을 허용한다.

DB에서는 강제하지 않는다.

API에서 상속, 경고, 검토 대상으로 처리한다.

Formula 수량 변경 시 Version과 Calculation Snapshot을 생성한다.

---

### DL-009. 입출금 엔진 2단 구조 확정

입출금은 아래 2단 구조를 사용한다.

```text
formula_payment_schedules = 예정 입출금
formula_payment_records = 실제 입출금 내역
```

단일, 분할, 부분, 선입금, 외상 모두 대응한다.

---

### DL-010. Payment Record Nullable 정책 확정

formula_payment_records에서 formula_id는 NOT NULL이다.

payment_schedule_id와 participant_id는 nullable 허용한다.

미매칭 입출금을 처리하기 위함이다.

---

### DL-011. Payment 정합성 강화

payment_schedules와 payment_records는 복합 FK 및 트리거를 통해 formula_id 소속 일치와 direction 일치를 보장한다.

---

### DL-012. 확정매출 기준 확정

확정매출은 실제 은행 입금액 기준으로 계산한다.

거래 기준, 계산서 기준 매출을 대표 KPI의 확정매출로 사용하지 않는다.

---

### DL-013. 확정순이익 기준 확정

```text
확정순이익 = 실입금 - 실출금
```

비용과 셰어는 실출금에 포함되므로 별도 차감하지 않는다.

중복 차감 금지.

---

### DL-014. 예상순이익 기준 확정

```text
예상순이익 = 총매출 - 총매입 - 비용 - 셰어
```

예상순이익은 Formula 기준이며 `formula_calculation_snapshots` 최신 레코드를 기준으로 한다.

---

### DL-015. 확정 KPI / 예상 KPI 분리 확정

확정 KPI와 예상 KPI는 절대 혼합하지 않는다.

---

### DL-016. 운송비 지급 대상 확정

운송비 지급 대상은 세금계산서를 발행한 운송사업체다.

실제 기사/차주와 세무 정산 대상은 다를 수 있으므로 분리 관리한다.

---

### DL-017. 운송비 부담 주체 확정

운송비가 존재하면 cost_bearer_company_id는 필수다.

운송비 처리 유형은 매입가 포함, 판매가 포함, 별도 비용처리를 지원한다.

---

### DL-018. 계산서 엔진 원칙 확정

계산서는 거래 진행 조건이 아니라 Formula 종결 조건이다.

```text
계산서 없어도 거래 진행 가능
계산서 없어도 입출금 가능
계산서 없으면 Formula 종결 불가
```

---

### DL-019. Invoice Participant 연결 확정

계산서는 participant 기준으로 연결한다.

issuer_participant_id, receiver_participant_id와 company_id의 일치를 트리거/API 검증으로 보장한다.

---

### DL-020. 계산서 금액 검증 확정

`external_invoice_amount`는 외부 계산서 원본 표시 금액이다.

`total_amount`는 supply_amount + tax_amount로 계산된 시스템 금액이다.

amount_verified는 트리거로 자동 계산한다.

invoice_status 전환은 API 레이어에서 담당한다.

---

### DL-021. 셰어 Source of Truth 확정

셰어의 원장은 `formula_shares`다.

`formula_participants.share_amount`는 사용하지 않는다.

---

### DL-022. 상태 구조 확정

Formula 상태는 아래 6개로 분리한다.

- trade_status
- cash_in_status
- cash_out_status
- invoice_status
- logistics_status
- delivery_status

상태를 단일 status 하나로 압축하지 않는다.

---

### DL-023. 상태 수동 처리 원칙 확정

상태는 자동 완료 처리하지 않는다.

실무자가 확인 후 수동 완료 처리한다.

시스템은 종결 가능 여부만 판단한다.

---

### DL-024. 상태변경 로그 정책 확정

상태 변경 발생 시 트랜잭션 내 아래 3개를 함께 처리한다.

```text
formula_status_logs INSERT
audit_logs INSERT
formulas UPDATE
```

---

### DL-025. Formula 종결 규칙 확정

아래 상태가 모두 충족되어야 Formula 종결 가능하다.

- trade_status = COMPLETED
- cash_in_status = COMPLETED
- cash_out_status = COMPLETED
- invoice_status = AMOUNT_MATCHED
- logistics_status = COMPLETED
- delivery_status = COMPLETED

---

### DL-026. Formula Version 정책 확정

Formula 내부 계산 결과에 영향을 주는 변경은 Version과 Calculation Snapshot을 생성한다.

대상:

- 단가 변경
- 수량 변경
- 참여자 변경
- 운송비 변경
- 환율 변경
- 셰어 변경

---

### DL-027. Audit Log 정책 확정

Audit Log는 포뮬러 외 시스템 전체 변경과 상태변경 감사 추적에 사용한다.

---

### DL-028. Formula 번호 체계 확정

Formula 번호는 아래 형식을 사용한다.

```text
FM-YYMM-NNNNN
```

예시:

```text
FM-2606-00001
```

채번은 PostgreSQL Sequence 기반으로 처리한다.

---

### DL-029. PostgreSQL Source of Truth 확정

PostgreSQL Schema를 DB 구조의 Source of Truth로 본다.

Prisma는 ORM 매핑 도구로 사용한다.

Generated Column, Trigger, View, Partial Index, Sequence, 고급 Constraint는 PostgreSQL migration supplement에서 관리한다.

---

### DL-030. v1.6.1 Supplement 사용 확정

v1.6 supplement는 사용하지 않는다.

v1.6.1 supplement 단일 파일을 사용한다.

트랜잭션으로 실행되며, View DROP → 컬럼 변경 → 제약/트리거 생성 → View 재생성 순서를 따른다.

---

### DL-031. DB Schema v1.6.1 최종 확정 가능

TOCS DB Schema v1.6.1은 최종 확정 가능 수준으로 승인한다.

다음 단계는 API 설계다.

---

### DL-032. V1 보류 기능 확정

아래 기능은 V1 핵심 구현에서 제외한다.

- 거래이슈 자동 감지 고도화
- 권한 구조 고도화
- 파일/증빙 고도화
- 은행 API 연동
- 환율 API 연동
- AI 리포트
- ERP 연동
- 거래처 포털
