# TOCS_BACKEND_IMPLEMENTATION_PLAN_v1.0

## 문서 목적

`docs/api/TOCS_API_SPEC_v1.1.md`와 `docs/api/API_MVP_SCOPE.md`를 기준으로
Backend 구현 계획을 정의한다. 이 문서는 설계 문서이며 다음을 포함하지
않는다.

- 실제 코드 구현
- Migration/SQL 생성
- DB 구조 변경
- `schema.prisma` 실제 파일

PostgreSQL Source of Truth 원칙(DECISION_LOG DL-017)에 따라, DB
무결성(Trigger/View/GENERATED/CHECK/복합FK)은 전부 PostgreSQL SQL
파일이 담당하며 Backend 코드는 그 결과를 신뢰하고 소비하는 역할만
한다. 이 원칙은 본 계획 전체의 전제다.

---

## 1. 계층 구조 (Repository / Service / Action)

### 1.1 계층 정의 및 책임 분리

```
Action Layer   (API Route Handler / Controller)
  ↓
Service Layer  (비즈니스 규칙, 트랜잭션 경계, API Layer 책임 수행)
  ↓
Repository Layer (Prisma Client 호출, DB 접근 only)
  ↓
PostgreSQL (Trigger / View / GENERATED / CHECK / 복합FK — Source of Truth)
```

| 계층 | 책임 | 책임이 아닌 것 |
|---|---|---|
| **Action** | HTTP Request 파싱, Request Body 검증(타입/필수값), Service 호출, HTTP Response 변환, 에러 코드 매핑(409/404/400) | 비즈니스 로직, DB 트랜잭션 관리 |
| **Service** | API_SPEC_v1.1이 명시한 "API Layer 책임" 전체 수행(아래 2장), 트랜잭션 경계 결정, 여러 Repository 호출 조합, 재시도 로직(Version API) | Prisma Client 직접 호출, SQL 작성 |
| **Repository** | Prisma Client를 통한 단일 테이블/모델 CRUD, Raw Query(View 조회·GENERATED 컬럼 읽기 시에만 한정적으로 사용) | 비즈니스 규칙 판단, 여러 테이블에 걸친 정합성 보장 |

### 1.2 계층 간 호출 규칙

- Action은 Repository를 직접 호출하지 않는다. 반드시 Service를 거친다.
- Service는 단일 트랜잭션이 필요한 작업을 `prisma.$transaction()`으로
  묶어 Repository 메서드들을 호출한다. 트랜잭션 경계 결정은 Service의
  책임이며 Repository는 트랜잭션 범위를 알지 못한다.
- Repository는 View 조회 시 Prisma의 `$queryRaw`를 사용한다(2.2절
  참조). 이는 "Prisma가 View를 모델링한다"는 의미가 아니라, "Prisma
  Client가 SQL 실행 통로로만 쓰인다"는 의미다.

---

## 2. API Layer 책임 — 전체 목록 (API_SPEC_v1.1 기준)

이 책임들은 전부 **Service Layer**가 수행한다. DB가 자동으로 대신해
주지 않는다는 사실이 TEST-001~011B 실행으로 실증되었으므로, 구현
누락 시 운영 데이터 불일치가 발생한다.

| # | 책임 | 근거 (API_SPEC_v1.1) | 트리거 시점 |
|---|---|---|---|
| 1 | `formula_no`를 절대 직접 지정하지 않음 (DEFAULT에 위임) | 핵심 정책 1 | Formula 생성 |
| 2 | `v_formula_invoice_status.derived_invoice_status` 조회 후 `formulas.invoice_status` UPDATE | 핵심 정책 2, 4.3 | 계산서 등록/수정/취소 |
| 3 | `formula_shares` 변경 시 합산 후 Version API를 호출하여 새 Snapshot 생성 (직접 UPDATE 금지) | 핵심 정책 3, 6.3 | Share 등록/수정/삭제 |
| 4 | `quantity`/단가/환율 등 Version 생성 대상 필드 변경 요청을 Formula 수정 API가 받지 않고 Version API로 라우팅 | 1.4 | Formula 수정 요청 수신 시 |
| 5 | `version_no` 충돌(23505) 시 재조회 후 1회 재시도, 실패 시 명시적 "동시 편집 충돌" 메시지 반환 | 7.1, 핵심 정책 8 | Version 생성 |
| 6 | Formula 종결 전 `v_formula_closeable.can_close` 선검증 | 8.2 | Formula 종결 |
| 7 | `is_closed = TRUE` Formula의 일반 속성 수정/취소 요청을 API가 명시적으로 거부 | 1.4, 8.1, MVP 금지 1·2 | Formula 수정/취소 |
| 8 | 이미 `is_canceled = TRUE`인 payment record 재취소 요청에 409 반환 | 3.3, MVP 금지 3 | 완료취소 |
| 9 | Cancel Undo / Close Undo 엔드포인트 자체를 노출하지 않음 | 8.4, MVP 금지 4 | 라우팅 설계 시점 |
| 10 | Formula 취소 시 6개 상태 UPDATE + `formula_status_logs` 6건 + `audit_logs` 1건을 하나의 트랜잭션으로 묶음 | 8.1 | Formula 취소 |
| 11 | 운송 상태 변경 시 `formula_status_logs` + `audit_logs` 동시 기록 | 5.3 | 운송 상태 변경 |
| 12 | 참여자 `quantity` 생략 시 `formulas.quantity` 자동 상속 | 2.3 | 참여자 추가 |
| 13 | 대시보드 응답에서 `CANCELED` Formula를 제외하고 싶다면 API가 직접 필터링(View는 필터링하지 않음) | 9.4, 핵심 정책 6 | KPI 조회 |
| 14 | `payment_records.is_canceled`와 `formulas.*_status=CANCELED`를 서로 다른 메커니즘으로 취급(하나의 변경이 다른 것을 자동 변경하지 않음을 전제로 로직 작성) | 핵심 정책 5 | 전체 |

---

## 3. 구현 순서 — Formula → Participant → Payment → Version → Invoice → Share → Cancel/Close → Dashboard

API_MVP_SCOPE.md의 의존관계 분석을 그대로 따른다. 순서를 바꾸면 후행
모듈이 선행 모듈의 검증되지 않은 동작에 의존하게 된다.

### 3.1 Formula 모듈 (1단계)

- Repository: `FormulaRepository` — `formulas` 테이블 CRUD
- Service: `FormulaService` — 1.1~1.5
  - 생성 시 `formula_no` 필드를 Request에서 절대 받지 않음(타입
    자체에 필드를 두지 않아 컴파일 단계에서 차단하는 것을 권장)
  - 수정 시 `quantity`/환율 필드가 포함되면 즉시 400 반환(Version
    API로 안내)
  - `is_closed = TRUE` 체크를 모든 수정성 메서드 진입점에 공통 가드로
    배치(중복 구현 방지를 위해 Service 내 공통 헬퍼로 추출)

### 3.2 Company / Participant 모듈 (1단계, Formula와 병행 가능)

- Repository: `CompanyRepository`, `ParticipantRepository`
- Service: `ParticipantService` — 2.1~2.3
  - `quantity` 생략 시 `FormulaRepository`에서 `formulas.quantity`를
    조회해 상속하는 로직은 Service에 위치(Repository는 상속 판단을
    하지 않음)
  - 2.4(순서 변경)는 **MVP 미구현**. 라우팅 자체를 만들지 않는다.

### 3.3 Payment 모듈 (2단계)

- Repository: `PaymentScheduleRepository`, `PaymentRecordRepository`
- Service: `PaymentService` — 3.1~3.4
  - `direction` 일치 여부는 DB Trigger(`trg_check_record_direction`)가
    강제하므로 Service가 사전 검증을 중복 구현할 필요는 없으나,
    트리거 예외(23514 등)를 사용자 친화적 메시지로 변환하는 책임은
    Service가 갖는다.
  - 완료취소 시 이미 취소된 record면 409(책임 8)

### 3.4 Version 모듈 (3단계 — Invoice/Share보다 먼저)

- Repository: `VersionRepository`, `SnapshotRepository`
- Service: `VersionService` — 7.1~7.4
  - `MAX(version_no) + 1` 계산과 INSERT 사이의 경쟁 조건을 전제로
    재시도 로직 구현(책임 5)
  - Version 생성과 Snapshot 생성은 항상 하나의 트랜잭션으로 묶음
    (복합 FK `fk_snapshot_version_formula`가 이 전제를 강제하므로,
    트랜잭션이 아니면 Version만 성공하고 Snapshot이 실패하는 상황이
    발생할 수 없는 게 아니라, 오히려 Service가 트랜잭션을 안 묶으면
    데이터 불일치 윈도우가 생긴다)
  - Version 모듈을 Invoice/Share보다 먼저 배치하는 이유: API_MVP_SCOPE의
    "Share API 6.3이 내부적으로 Version API를 호출"하는 의존관계 때문.

### 3.5 Invoice 모듈 (3단계, Version과 독립적으로 병행 가능)

- Repository: `InvoiceRepository`
- Service: `InvoiceService` — 4.1~4.3
  - participant-company 일치는 DB Trigger가 강제하므로 사전 검증
    불필요. 트리거 예외 메시지 변환만 책임.
  - **4.3 동기화는 Service의 필수 후처리 단계**로 구현: 계산서
    등록/수정/취소 메서드 끝에 항상
    `v_formula_invoice_status` 조회 → `formulas.invoice_status` UPDATE
    를 호출하는 공통 후크로 구성(누락 방지를 위해 개별 메서드가 직접
    호출하지 않고 공통 후처리 단계에 위치시키는 것을 권장).

### 3.6 Share 모듈 (4단계, Version 의존)

- Repository: `ShareRepository`
- Service: `ShareService` — 6.1~6.3
  - Share 변경 메서드는 내부적으로 `VersionService.createVersion()`을
    호출한다(책임 3). `SnapshotRepository`를 직접 호출하지 않는다 —
    반드시 `VersionService`를 경유해야 복합 FK 정합성이 보장된다.

### 3.7 Cancel / Close 모듈 (5단계)

- Repository: `FormulaRepository`(상태 컬럼 UPDATE), `StatusLogRepository`,
  `AuditLogRepository`
- Service: `FormulaLifecycleService` — 8.1~8.4
  - 8.1(취소): 6개 상태 UPDATE + status_logs 6건 + audit_logs 1건을
    단일 트랜잭션으로(책임 10)
  - 8.2(종결): `v_formula_closeable.can_close` 선조회 후에만 UPDATE
    진행(책임 6)
  - 8.4: 라우팅 자체를 정의하지 않음(책임 9)

### 3.8 Logistics 모듈 (Payment 이후 어느 시점에든 가능, 의존관계 약함)

- Repository: `LogisticsRepository`
- Service: `LogisticsService` — 5.1~5.3
  - 5.3 상태 변경 시 status_logs + audit_logs 동시 기록(책임 11)

### 3.9 Dashboard / KPI 모듈 (6단계, 최후)

- Repository: `KpiViewRepository`(View 전용, `$queryRaw` 사용)
- Service: `DashboardService` — 9.1~9.4
  - 우선순위: 9.1·9.3 → 9.2(Version 모듈 완료 후 의미 있음) → 9.4(가장
    복잡, 취소 필터링 책임 포함)
  - 9.4에서 `CANCELED` Formula 제외가 필요하면 Service가
    `formulas.*_status` 또는 `is_closed`를 조회해 결과를 필터링(책임 13).
    View 자체는 이 필터링을 하지 않는다는 사실을 코드 주석에도 남길 것.

---

## 4. Prisma의 역할 한정 — 이 계획 전체에 적용되는 전제

Prisma는 **DB Source of Truth가 아니라 ORM 매핑 도구**다(DECISION_LOG
DL-017). 이 계획의 모든 Repository는 다음 전제 위에서 설계된다.

- Repository가 다루는 모든 정합성 보장(Trigger, CHECK, GENERATED,
  복합FK, View)은 이미 PostgreSQL이 수행했거나 수행 중인 것이며,
  Repository 코드는 이를 재구현하지 않는다.
- View 조회는 Prisma 모델로 표현하지 않고, Repository 내부에서
  `$queryRaw`로 한정적으로 처리한다(상세 — `PRISMA_MODEL_DESIGN_v1.0.md`
  2장).
- Prisma Client가 생성하는 타입은 "테이블 컬럼"만 반영하며, GENERATED
  컬럼·View 파생 컬럼은 별도의 수동 타입 정의가 필요하다(상세 —
  동 문서 3장).

---

## 5. 다음 단계 (이 계획 밖)

이 문서는 설계만 다룬다. 실제 `schema.prisma` 작성, Repository/Service
코드 구현, API Route 구현은 이 계획이 승인된 이후의 별도 작업이며
본 문서의 범위에 포함되지 않는다.
