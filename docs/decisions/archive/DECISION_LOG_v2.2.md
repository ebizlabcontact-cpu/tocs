# DECISION_LOG_v2.0

## 2026-06-22

### DL-001. Formula First Architecture 확정

TOCS는 Formula 중심 시스템으로 설계한다.

모든 KPI와 경영지표는 Formula에서 파생된다.

---

### DL-002. Formula 1개 = 품목 1개 확정

V1 기준 Formula 1개에는 품목 1개만 연결한다.

다품목 거래는 품목별 Formula를 별도 생성한다.

---

### DL-003. Deal / Order Entity 생성 금지

TOCS는 Deal 중심 시스템이 아니다.

Deal, Order, Project, Pipeline을 최상위 Entity로 생성하지 않는다.

---

### DL-004. Company / Role 분리 확정

모든 참여자는 Company로 관리한다.

Company 자체는 고정 역할을 갖지 않는다.

역할은 Formula 내부에서 결정한다.

---

### DL-005. Formula Participants 구조 확정

A > B > C > D 구조는 `formula_participants`와 `sequence_order`로 표현한다.

`UNIQUE(formula_id, company_id)`는 사용하지 않는다.

동일 Company가 하나의 Formula 안에서 복수 역할을 수행할 수 있다.

---

### DL-006. 입출금 엔진 2단 구조 확정

입출금은 아래 2단 구조를 사용한다.

```text
formula_payment_schedules = 예정 입출금
formula_payment_records = 실제 입출금 내역
```

단일, 분할, 부분, 선입금, 외상 모두 대응한다.

---

### DL-007. 완료취소 원칙 확정

입출금 레코드는 삭제하지 않는다.

취소 시 `is_canceled = TRUE`로 보존한다.

취소된 레코드는 확정 KPI에서 제외한다.

TEST-002에서 실제 PostgreSQL 검증 완료.

---

### DL-008. 확정순이익 기준 확정

```text
확정순이익 = 실입금 - 실출금
```

비용과 셰어는 실출금에 포함되므로 별도 차감하지 않는다.

---

### DL-009. 예상순이익 기준 확정

```text
예상순이익 = 총매출 - 총매입 - 비용 - 셰어
```

예상순이익은 Formula 기준이며 `formula_calculation_snapshots` 최신 레코드를 기준으로 한다.

---

### DL-010. 확정 KPI / 예상 KPI 분리 확정

확정 KPI와 예상 KPI는 절대 혼합하지 않는다.

---

### DL-011. 계산서 엔진 원칙 확정

계산서는 거래 진행 조건이 아니라 Formula 종결 조건이다.

---

### DL-012. amount_verified 정책 확정

`amount_verified`는 사용자 입력값이 아니라 시스템 자동 계산값이다.

`external_invoice_amount`와 `total_amount` 비교 결과로 산출한다.

실제 PostgreSQL 검증 중 NULL 오류가 발견되어 `sync_invoice_amount_verified()` 함수를 보강했다.

---

### DL-013. Formula 상태 구조 확정

Formula 상태는 아래 6개로 분리한다.

- trade_status
- cash_in_status
- cash_out_status
- invoice_status
- logistics_status
- delivery_status

---

### DL-014. 상태 수동 처리 원칙 확정

상태는 자동 완료 처리하지 않는다.

실무자가 확인 후 수동 완료 처리한다.

시스템은 종결 가능 여부만 판단한다.

---

### DL-015. Formula 종결 규칙 확정

아래 상태가 모두 충족되어야 Formula 종결 가능하다.

- trade_status = COMPLETED
- cash_in_status = COMPLETED
- cash_out_status = COMPLETED
- invoice_status = AMOUNT_MATCHED
- logistics_status = COMPLETED
- delivery_status = COMPLETED

---

### DL-016. Formula 번호 체계 확정

Formula 번호는 아래 형식을 사용한다.

```text
FM-YYMM-NNNNN
```

채번은 PostgreSQL Sequence 기반으로 처리한다.

---

### DL-017. PostgreSQL Source of Truth 확정

PostgreSQL Schema를 DB 구조의 Source of Truth로 본다.

Prisma는 ORM 매핑 도구로 사용한다.

Generated Column, Trigger, View, Partial Index, Sequence, 고급 Constraint는 PostgreSQL supplement에서 관리한다.

---

### DL-018. 최종 DB 파일 체계 변경 확정

기존 v1.5/v1.6.1 다단계 체계는 폐기한다.

최종 운영 파일 체계:

```text
tocs_base_schema.sql
tocs_supplement.sql
tocs_fix_amount_verified.sql
```

---

### DL-019. 실제 PostgreSQL 실행 검증 완료

Docker PostgreSQL 16 환경에서 아래 항목의 실제 실행을 확인했다.

- 15개 테이블 생성
- 6개 View 생성
- Trigger 생성
- Composite FK 생성
- Generated Column 생성
- Partial Index 생성

---

### DL-020. TEST-001 PASS

TEST-001 실제 거래 시뮬레이션이 통과했다.

검증 항목:

- Formula 생성
- Participant 구조
- Payment 기본 집계
- Invoice amount_verified
- Profit Engine
- Closeable Engine
- Participant KPI

---

### DL-021. TEST-002 PASS

TEST-002 Payment Engine 예외 검증이 통과했다.

검증 항목:

- 분할입금
- 부분출금
- 완료취소 후 재입금
- canceled record KPI 제외
- 미수금
- 미지급금
- 입금률
- 출금률
- 확정순이익
- v_payment_unmatched

자동 검증 9개 지표 모두 PASS.

---

### DL-022. TEST-003 PASS

TEST-003 외상거래 검증이 통과했다.

검증 항목:

- schedule 존재
- record 0건
- confirmed KPI 0 처리
- receivable/payable 전액 발생
- receive_rate/payment_rate 0.00 처리
- can_close FALSE

자동 검증 10개 지표 모두 PASS.

---

### DL-023. Git 버전관리 도입 확정

TOCS 프로젝트에 Git을 적용했다.

현재 기준:

```text
main branch
tag: v4.8-db-verified
commit: TOCS v4.8 TEST-003 PASS
```

---

### DL-024. 폴더 구조 정리 확정

운영 구조:

```text
docs/master
docs/decisions
db/schema
db/fixes
db/tests
ai/prompts
ai/archive
.cursor/rules
```

---

### DL-025. 다음 검증 순서 확정

다음 검증 순서:

1. TEST-004 수입/환율 거래
2. TEST-005 물류비 / carrier / cost_bearer
3. TEST-006 종결 검증
4. TEST-007 Version 생성
5. TEST-008 대량 데이터 / KPI 성능

---

### DL-026. V1 보류 기능 확정

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

### DL-027. Formula Number Auto Generation Policy

formula_no는 항상 `DEFAULT generate_formula_no()`를 사용하여 생성한다.

INSERT 시 formula_no를 직접 지정하지 않는다.

사유:

직접 지정 시 `formula_seq` Sequence가 증가하지 않는다.

이후 자동 채번이 동일 번호에 도달하면 UNIQUE 제약 위반이 발생할 수 있다.

TEST-008 작성 중 이 위험이 실제로 식별되어 자동 채번 방식으로 통일했다.

상태: ACCEPTED

---

### DL-028. Invoice Status Synchronization Responsibility

`formulas.invoice_status`를 자동으로 동기화하는 Trigger는 사용하지 않는다.

`formula_invoices`의 개별 계산서 상태는 `v_formula_invoice_status` View가
파생 계산(`derived_invoice_status`)한다.

API Layer가 `v_formula_invoice_status`를 읽어 `formulas.invoice_status`를
갱신할 책임을 갖는다.

상태: ACCEPTED

---

### DL-029. Share Snapshot Synchronization Responsibility

`formula_shares`는 셰어의 상세 원장이다.

`formula_calculation_snapshots.total_share`는 셰어의 집계 스냅샷이다.

두 값은 DB 레벨에서 자동으로 동기화되지 않는다.

`formula_shares` 변경 시 `formula_calculation_snapshots.total_share`의
재계산 책임은 API Layer가 갖는다.

상태: ACCEPTED
