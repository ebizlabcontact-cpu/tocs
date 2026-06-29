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


---

### DL-030. Profit Engine Latest Snapshot Selection Criteria

v_formula_profit_engine은 최신 Snapshot 판단 시 version_no 기준을 우선 사용한다.

TEST-009에서 검증 완료.

상태: ACCEPTED

---

### DL-031. Formula Cancel Flow Policy

Formula 취소는 6개 상태를 CANCELED로 전환하여 처리한다.

is_closed=TRUE 상태에서는 CHECK Constraint에 의해 취소할 수 없다.

TEST-010에서 검증 완료.

상태: ACCEPTED

---

### DL-032 Formula Version Trigger Policy

Formula 계산 결과에 영향을 주는 변경은
기존 Snapshot 수정이 아닌
신규 Version 생성으로 처리한다.

대상:

- quantity
- formula_participants 레코드 추가
- formula_participants 레코드 삭제
- formula_participants.quantity 변경
- formula_participants.buy_unit_price 변경
- formula_participants.sell_unit_price 변경
- buy_unit_price
- sell_unit_price
- contract_exchange_rate
- adjusted_exchange_rate
- logistics_cost
- share_amount
- share_rate

Version 생성 시:

- formula_versions 생성
- formula_calculation_snapshots 생성
- audit_logs 기록

기존 Snapshot 수정은 허용하지 않는다.

TEST-009, TEST-011 검증 완료.

Version 생성 대상이 아닌 변경:

- sequence_order 변경
- role_group 변경
- nature_group 변경
- payment_group 변경
- 메모성 필드 변경

상태: ACCEPTED

---

### DL-033. Closed Settlement Policy

`is_closed = TRUE` 이후에도 **정산 이슈 처리**는 허용한다.

단, **원본 거래 직접 수정**은 금지한다.

**금지 (Closed Formula — normal update paths)**

- `quantity`, 단가(`buy_unit_price`/`sell_unit_price`), 환율
  (`contract_exchange_rate`/`adjusted_exchange_rate`) 직접 변경
- 참여자/거래처(`formula_participants`) 추가·변경·삭제
- 기존 `formula_calculation_snapshots` 직접 수정
- 기존 `formula_payment_records.actual_amount` 직접 수정
- 기존 `formula_invoices` 금액 필드 직접 수정
- 기존 `formula_shares` 직접 변경
- Version 생성(위 변경 목적)
- Share CRUD
- Formula 일반 수정 API(1.4: `content`/`note`/`unit` 포함)
- Formula 취소(8.1) — DB CHECK로도 차단됨(DL-031)

**허용 (Settlement API 또는 명시적 allowlist만)**

- 추가 payment record 등록(3.2, append-only)
- payment record cancel(3.3) 후 재입금 record 등록
- payment schedule 추가 — **Settlement API 경로에서만**
  (일반 3.1은 Closed Formula에서 거부)
- invoice status 재동기화 — `derived_invoice_status = 'AMOUNT_MATCHED'`일
  때만 `formulas.invoice_status`에 반영
- 정산 메모/이슈 — `audit_logs` INSERT
- 미수/미지급 조회(3.4) 및 확정 KPI 조회(9.1, 9.3)

**MVP 제외 (V2 재검토)**

- Reopen (`is_closed TRUE → FALSE`)
- Close undo
- Adjustment Formula top-level entity

**근거**

- `chk_closed_requires_all_completed`: 종결 후 6개 status는 COMPLETED/
  AMOUNT_MATCHED로 동결. `formulas.invoice_status` sync는 이 CHECK와
  충돌할 수 있으므로 조건부 반영 필요.
- TEST-002: payment record cancel 후 재입금 패턴 검증 완료.
- 확정 KPI는 `v_formula_confirmed_kpi`가 payment record 기준 실시간
  반영 — 종결 후에도 ledger 보정 가능.

상태: ACCEPTED

---

## 2026-06-28

### DL-034. Core MVP Backend + HTTP Slice Accepted

**결정**

TOCS Core MVP Backend 및 HTTP slice를 **공식 Accepted** 상태로 확정한다.

**Accepted 범위**

- Core MVP Domains 전부 완료: Formula (PATCH, Cancel 포함), Company,
  Participant, Payment, Invoice, Logistics, Version, Share, Close,
  Settlement (DL-033), Dashboard/KPI, HTTP layer.
- Action-backed HTTP Routes: **48**.
- Remaining Core MVP gap: **0** (`API_MVP_SCOPE.md` 기준).

**검증 근거**

- Integration suite: **212 pass / 0 fail / 0 skip**
  (`npm run test:integration`, `--test-concurrency=1`).
- GitHub Actions CI: workflow `CI`, `push` → `main`, run **SUCCESS**
  (commit `fa809e4`, run `28326776089`).
- DB schema: SQL 3파일 순서 적용 (`tocs_base_schema.sql` →
  `tocs_supplement.sql` → `tocs_fix_amount_verified.sql`).
  Prisma migrate / db push 미사용.

**Release governance**

- Git tag: **`v1.0.0`** (SemVer; see `docs/releases/RELEASE_GOVERNANCE.md`,
  `docs/releases/v1.0.0.md`).
- `CHANGELOG.md`, `RELEASE_NOTES.md`에 동일 마일스톤 기록.
- Legacy suffix tag `v1.0.0-core-mvp-accepted` 등은 이력 보존; 신규 suffix tag
  생성 금지 (DL-035).

**MVP 제외 / Deferred (이번 Accepted에 포함하지 않음)**

- Auth/RBAC, File Evidence, Notification
- Reopen, Cancel undo, Close undo
- Adjustment Formula top-level entity
- Participant order swap API (§2.4)
- Formula partial cancel
- Version advanced retry (multi-retry / exponential backoff)
- Logistics §5.3 `audit_logs` INSERT (status log만 MVP)

**근거**

- Formula First Architecture 및 DL-001~DL-033 정책 준수.
- Acceptance Fix Batch 1~3 및 CI Minimal Implementation 완료 후
  로컬·GitHub CI 모두 green.

상태: ACCEPTED

---

### DL-035. Release Tag SemVer Governance

**결정**

TOCS Git release tag는 **Semantic Versioning `vMAJOR.MINOR.PATCH`만** 사용한다.

**규칙**

- 신규 tag에 milestone suffix 금지 (예: `-core-mvp-accepted`, `-ci-minimal`).
- 4자리·patch-batch 형식 tag 금지 (예: `v1.2.2.1`).
- Environment, Logging, Health 등 세부 작업은 `CHANGELOG.md`와
  `docs/releases/vX.Y.Z.md`에만 기록.
- `v1.2.x` 내부 engineering batch는 **Production Hardening**으로 `v1.2.0` tag에
  통합.
- 기존 legacy suffix tag는 삭제·이동하지 않음; 신규 생성만 금지.

**Tag map**

| Tag | Milestone |
|-----|-----------|
| `v1.0.0` | Core MVP Backend + HTTP slice Accepted (DL-034) |
| `v1.2.0` | Production Hardening |

**근거**

- GitHub Release·CI 연동 단순화.
- 운영자가 tag만으로 배포 단위 식별 가능.
- 내부 batch ID와 배포 tag 분리로 거버넌스 명확화.

상태: ACCEPTED

---

## 2026-06-23

### DL-036. Local Development Database Port Policy

**Title:** Local Development Database Port Policy

**결정**

- **Windows PostgreSQL service:** `localhost:5432` — OS-installed instance; not the TOCS local dev target.
- **TOCS Docker PostgreSQL:** `localhost:5433` — standard `tocs-postgres` container; host port **5433** maps to container **5432**.

**Reason**

Prevent accidental connection to the Windows PostgreSQL service and integration test authentication failures (`Authentication failed against the database server`) caused by wrong host/port or credential mismatch.

**Operational references**

- [`docs/operations/ENVIRONMENT.md`](../operations/ENVIRONMENT.md) — §9 port policy, §10 checklist, §11 troubleshooting
- [`docs/operations/LOCAL_DEVELOPMENT.md`](../operations/LOCAL_DEVELOPMENT.md) — bootstrap and schema apply

상태: ACCEPTED

---

### DL-037. PostgreSQL Backup and Restore Policy

**Title:** PostgreSQL Backup and Restore Policy

**Status:** ACCEPTED

**결정**

| Environment | Backup | Retention |
|-------------|--------|-----------|
| Local | Manual `pg_dump` (developer-initiated) | Latest dump only |
| CI | None — ephemeral Postgres service | Job lifetime only |
| Production | Daily logical backups, weekly snapshots, monthly archive | Platform/DBA policy |

**Rules**

1. Schema recovery uses SQL files in `DB_APPLY_ORDER.md`; dumps are for **data** recovery.
2. Never restore production data into local or CI databases.
3. Post-restore verification: row counts, schema smoke (15 tables / 6 views), integration suite `212/212`.
4. Backup artifacts are sensitive — never commit to git.

**Operational reference**

- [`docs/operations/BACKUP_AND_RESTORE.md`](../operations/BACKUP_AND_RESTORE.md)

상태: ACCEPTED

---

### DL-038. Error Handling and Incident Response Policy

**Title:** Error Handling and Incident Response Policy

**Status:** ACCEPTED

**결정**

1. **Error taxonomy** — ValidationError, ActionError, NotFound, Conflict, InfrastructureError, UnexpectedError (`docs/operations/ERROR_HANDLING.md`).
2. **HTTP errors** — Target body: `request_id`, `status`, `code`, `message`; Core MVP returns `{ message }` + `x-request-id` header until HTTP error envelope milestone.
3. **Logging** — JSON lines; levels `error` / `warn` / `info` / `debug`; `redactSensitive()` mandatory for secrets.
4. **Incidents** — Runbooks for PostgreSQL auth/unavailable, port collision, CI/integration/GitHub Actions failure (`docs/operations/INCIDENT_RESPONSE.md`).
5. **Recovery verification** — `pg_isready`, health check, `212/212` integration, CI green.

**Excluded (V2)**

- Notification / on-call
- Auth/RBAC error codes
- Full error `code` field in HTTP JSON body

**Operational references**

- [`docs/operations/ERROR_HANDLING.md`](../operations/ERROR_HANDLING.md)
- [`docs/operations/INCIDENT_RESPONSE.md`](../operations/INCIDENT_RESPONSE.md)
- [`docs/operations/LOGGING.md`](../operations/LOGGING.md)

상태: ACCEPTED

---

### DL-039. Release and Deployment Governance

**Title:** Release and Deployment Governance

**Status:** ACCEPTED

**결정**

1. **Release gates** — `main` CI green, `typecheck` pass, integration **212/212**, CHANGELOG/RELEASE_NOTES updated before tag.
2. **Tag policy** — SemVer `vMAJOR.MINOR.PATCH` only (DL-035); v1.0.x MVP, v1.1.x CI, v1.2.x hardening, v1.3.x Auth (future), v2.x expansion; **4-part tags forbidden**.
3. **Deployment** — Env validation, SQL-first schema (base → supplement → fix), **backup before production schema apply**, health check, rollback point required.
4. **Rollback** — App redeploy prior tag; DB restore from backup (no Prisma down-migrate).
5. **Hotfix** — Branch from latest accepted tag, minimal fix, CI green, PATCH bump only.
6. **CI gate** — Failed CI on `main` → **release forbidden**.

**Excluded**

- Deploy automation / CD pipelines (V2)
- Auth/RBAC release (v1.3.x milestone)

**Operational reference**

- [`docs/operations/RELEASE_AND_DEPLOYMENT.md`](../operations/RELEASE_AND_DEPLOYMENT.md)
- [`docs/releases/RELEASE_GOVERNANCE.md`](../releases/RELEASE_GOVERNANCE.md)

상태: ACCEPTED

---

### DL-040. Production Readiness Assessment

**Title:** Production Readiness Assessment

**Status:** ACCEPTED

**결정**

1. **Assessment scope** — Backend, database, environment, CI, logging, errors, incidents, release, security, monitoring, backup (`docs/operations/PRODUCTION_READINESS_REVIEW.md`).
2. **Gate status** — Core MVP **ACCEPTED** (DL-034); integration **212/212**; CI and typecheck **green**.
3. **Readiness matrix** — Core backend, schema, CI, env, logging, health, incident/release runbooks: **READY**; error envelope, monitoring, backup: **PARTIAL**; Auth/RBAC, deploy automation: **NOT_READY**.
4. **Go-live recommendation** — Label: **Production Hardened Candidate**; **Production Ready: NO** — Auth/RBAC and automated ops intentionally deferred.
5. **Production blockers** — Auth/RBAC, secret rotation automation, monitoring stack, backup automation, deployment automation.
6. **Next milestone** — **v1.3.0 Auth/RBAC Foundation**.

**Operational reference**

- [`docs/operations/PRODUCTION_READINESS_REVIEW.md`](../operations/PRODUCTION_READINESS_REVIEW.md)

상태: ACCEPTED

---

### DL-041. Authentication and RBAC Foundation

**Title:** Authentication and RBAC Foundation

**Status:** ACCEPTED

**결정**

1. **Scope** — Auth Foundation v1.3.0 is **specification and architecture only**; no DB schema, routes, middleware, JWT, or user tables in this milestone.
2. **Authentication** — Bearer JWT access tokens (`JWT_SECRET`); refresh via session strategy (`SESSION_SECRET`); fail closed on protected routes (future enforcement).
3. **RBAC** — System roles (`SYSTEM_ADMIN`, `OPS_MANAGER`, `FINANCE`, `CLOSER`, `VIEWER`) grant `{resource}:{action}` permissions; **separate from** `formula_participants.role_group` (DL-004).
4. **Architecture** — Auth/RBAC at HTTP boundary only; Action → Service → Repository discipline preserved.
5. **Public endpoint** — `GET /api/v1/health` remains unauthenticated.
6. **Phased rollout** — v1.3.0 docs → v1.3.1 middleware → v1.3.x enforcement + test slice.
7. **Integration gate unchanged** — 212/212 without auth headers until auth test milestone approved.

**Operational references**

- [`docs/specs/AUTH_RBAC_SPEC.md`](../specs/AUTH_RBAC_SPEC.md)
- [`docs/architecture/AUTH_ARCHITECTURE.md`](../architecture/AUTH_ARCHITECTURE.md)

상태: ACCEPTED

---

### DL-042. Authentication Database Foundation

**Title:** Authentication Database Foundation

**Status:** ACCEPTED

**결정**

1. **Scope** — v1.3.1 is **schema design documentation only**; no `db/schema/*.sql`, Prisma, or migration changes in this milestone.
2. **Tables** — `users`, `company_memberships`, `sessions` (minimum auth persistence).
3. **Membership role enum** — `SUPER_ADMIN`, `COMPANY_ADMIN`, `MANAGER`, `VIEWER` on `company_memberships.role`.
4. **Relationships** — user → memberships → `companies`; indirect formula access via `formula_participants.company_id`.
5. **Sessions** — store `refresh_token_hash` only; access JWT remains stateless.
6. **Apply order (future)** — 4th file `tocs_auth_schema.sql` after existing 3 SQL files; update `DB_APPLY_ORDER.md` when implemented.
7. **Deferred** — OAuth, 2FA, invitation, API keys, permission builder, ABAC, multi-organization.
8. **Integration gate unchanged** — 212/212 without auth tables until SQL apply milestone.

**Operational reference**

- [`docs/specs/AUTH_DB_SCHEMA.md`](../specs/AUTH_DB_SCHEMA.md)

상태: ACCEPTED

---

### DL-043. JWT and Session Strategy

**Title:** JWT and Session Strategy

**Status:** ACCEPTED

**결정**

1. **Scope** — v1.3.2 is **strategy documentation only**; no JWT library, session repository, login API, or middleware.
2. **Access token** — JWT HS256, **15 minutes** TTL; claims: `sub`, `email`, `roles`, `memberships` summary, `iat`, `exp`; signed with `JWT_SECRET`.
3. **Refresh token** — Opaque random, **14 days** TTL; HttpOnly Secure SameSite cookie; DB stores `refresh_token_hash` only.
4. **Rotation** — Each refresh issues new access + refresh; prior session `revoked_at = NOW()`.
5. **Reuse detection** — Presenting revoked refresh → revoke **all** user sessions + 401.
6. **Logout** — Revoke current session + clear cookie; **logout all** revokes all active sessions for user.
7. **Security** — `JWT_SECRET` + `SESSION_SECRET` required in production; no tokens in logs; `ENCRYPTION_KEY` reserved.
8. **Deferred** — OAuth, 2FA, device fingerprinting, anomaly detection, password reset, email verification.
9. **Integration gate unchanged** — 212/212 without auth until middleware milestone.

**Operational reference**

- [`docs/specs/AUTH_TOKEN_SESSION_STRATEGY.md`](../specs/AUTH_TOKEN_SESSION_STRATEGY.md)

상태: ACCEPTED

---

### DL-044. Password and Credential Policy

**Title:** Password and Credential Policy

**Status:** ACCEPTED

**결정**

1. **Scope** — v1.3.3 is **credential policy documentation only**; no password hashing, login API, user table SQL, or bootstrap command.
2. **Hashing** — **Argon2id** primary (m=65536, t=3, p=4); **bcrypt** cost ≥ 12 fallback only if Argon2 runtime unavailable.
3. **Validation** — Min length **12**; passphrases allowed; ≥ 2 character categories; block email-as-password and obvious service/company tokens.
4. **Lockout** — **5** failures within **15** minutes → **LOCKED** for **15** minutes; reset counter on successful login.
5. **Account status** — `ACTIVE`, `INVITED`, `SUSPENDED`, `LOCKED` (supersedes v1.3.1 `PENDING` at SQL apply).
6. **Bootstrap** — One-time admin via explicit env vars; **no** production default password; `audit_logs` required.
7. **Password reset** — **Deferred**; no email reset in Auth MVP; admin reset documented as future scope.
8. **Sensitive data** — Never log or return password / `password_hash`; generic credential error messages.
9. **Deferred** — Password reset email, 2FA, breach DB, device trust, SSO/OAuth.
10. **Integration gate unchanged** — 212/212 without auth until implementation milestone.

**Operational reference**

- [`docs/specs/AUTH_CREDENTIAL_POLICY.md`](../specs/AUTH_CREDENTIAL_POLICY.md)

상태: ACCEPTED

---

### DL-045. RBAC Permission Matrix

**Title:** RBAC Permission Matrix

**Status:** ACCEPTED

**결정**

1. **Scope** — v1.3.4 is **permission matrix documentation only**; no middleware, route protection, or `RbacService` code.
2. **Roles** — `SUPER_ADMIN`, `COMPANY_ADMIN`, `MANAGER`, `VIEWER` on `company_memberships.role` (canonical; supersedes v1.3.0 global roles).
3. **Actions** — `read`, `create`, `update`, `delete`, `cancel`, `close`, `settle`, `admin`; `approve` reserved (deferred).
4. **SUPER_ADMIN** — All resources/actions; no company scope limit.
5. **COMPANY_ADMIN** — Company-scoped; sensitive ops allowed (cancel, close, settlement, membership, company update, session revoke-all).
6. **MANAGER** — Company-scoped operational create/update; **denied** cancel, close, settlement, membership admin, payment cancel.
7. **VIEWER** — Company-scoped read + dashboard only; no mutations.
8. **Company scope** — Formula access via `formula_participants.company_id`; dashboard requires company filter.
9. **Deferred** — ABAC, custom permission builder, RLS, approval workflow, delegated admin, external auditor role.
10. **Integration gate unchanged** — 212/212 without auth until middleware milestone.

**Operational reference**

- [`docs/specs/RBAC_PERMISSION_MATRIX.md`](../specs/RBAC_PERMISSION_MATRIX.md)

상태: ACCEPTED

---

### DL-046. Route Protection Policy

**Title:** Route Protection Policy

**Status:** ACCEPTED

**결정**

1. **Scope** — v1.3.5 is **route protection documentation only**; no middleware, route code, Service, or test changes.
2. **Route count** — All **48** Core MVP HTTP routes classified (verified against `src/http/routes/*.ts` and `API_MVP_SCOPE.md`).
3. **Protection levels** — `PUBLIC`, `AUTHENTICATED`, `RBAC`, `COMPANY_SCOPED`, `SUPER_ADMIN_ONLY`.
4. **Public** — `GET /api/v1/health` only; **47** business routes require authentication in production.
5. **RBAC floors** — Aligned with DL-045: `VIEWER` read; `MANAGER` operational mutations; `COMPANY_ADMIN`+ for cancel, close, settlement, payment record cancel, company create.
6. **Company scope** — `SUPER_ADMIN` bypass; others via `company_memberships` + formula `formula_participants` linkage; dashboard company filter mandatory.
7. **Route registry** — Per-route method, path, domain, protection level, min role, permission key, scope rule in `ROUTE_PROTECTION_POLICY.md` §7.
8. **Deferred** — RLS, policy engine, custom permissions, API keys, service accounts, external auditor, public share links.
9. **Integration gate unchanged** — 212/212 without auth headers until middleware milestone.

**Operational reference**

- [`docs/specs/ROUTE_PROTECTION_POLICY.md`](../specs/ROUTE_PROTECTION_POLICY.md)

상태: ACCEPTED

---

### DL-047. Authentication Implementation Plan

**Title:** Authentication Implementation Plan

**Status:** ACCEPTED

**결정**

1. **Scope** — v1.3.6 is **implementation plan documentation only**; no SQL, Prisma, Service, middleware, route, or test code.
2. **Phase 1** — Auth SQL apply: `users`, `company_memberships`, `sessions` (`tocs_auth_schema.sql`).
3. **Phase 2** — Repositories + Argon2id credential validation + bootstrap.
4. **Phase 3** — Auth services + HTTP routes: login, logout, refresh, me.
5. **Phase 4** — JWT issuing, refresh rotation, session revocation (DL-043).
6. **Phase 5** — Auth middleware, request context, company scope resolution.
7. **Phase 6** — RBAC middleware, permission guards, 48-route protection (DL-046).
8. **Phase 7** — Integration tests: authentication, authorization, session.
9. **Non-goals** — OAuth, SSO, 2FA, API keys, password reset email, external IdP, custom policy engine, ABAC.
10. **Integration gate** — **212/212** maintained through Phases 1–6; Phase 7 adds auth test slice.

**Operational reference**

- [`docs/specs/AUTH_IMPLEMENTATION_PLAN.md`](../specs/AUTH_IMPLEMENTATION_PLAN.md)

상태: ACCEPTED
