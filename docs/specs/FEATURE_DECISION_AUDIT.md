# TOCS Feature Decision Audit

## Document status

| Field | Value |
|-------|--------|
| **Version** | v1.0 |
| **Date** | 2026-06-23 |
| **Type** | Product behavior audit (documentation only) |
| **Scope** | Auth, navigation, company context, dashboard, and named product modules |
| **Code changes** | None — read-only review of specs, decision log, and shipped backend |

**Purpose:** Identify product behaviors that are **fixed in spec or code without explicit product-owner (대표님) approval**, and separate **approved / spec-only / ungoverned** items before the next UI or productization milestone.

**Sources reviewed:** `docs/decisions/DECISION_LOG.md` (DL-033–DL-050), `docs/specs/*`, `PROJECT_CONTEXT.md`, `CHANGELOG.md`, `src/http/routes/*`, `src/http/plugins/*`, `docs/api/API_MVP_SCOPE.md`.

---

## Executive summary

| Category | Count | Meaning |
|----------|------:|---------|
| **Shipped & DL-accepted** | 3 areas | Auth core, protected routes, settlement **API** policy — engineering gate passed; treat as stable unless product reopen |
| **DL-accepted, spec-only (product UX not built)** | 4 areas | Login→Dashboard, company switcher UX, Dashboard v1 layout, SUPER_ADMIN all-scope **product rules** |
| **Partially shipped / doc drift** | 2 areas | Company context middleware + service filters; logout transport vs spec |
| **No repo spec (name only)** | 3 areas | Formula Wizard, Payment Timeline, Settlement Center — **not governed**; highest approval risk |

### Top findings — “멋대로 확정” 후보

1. **DL-050 번들 수용** — Global Company Context 정책(DL-050) ACCEPTED 시 Login→Dashboard, blocking company overlay, Dashboard landing, SUPER_ADMIN default `all` 등 **UX 세부가 한 번에 묶여 확정된 것처럼** 기록됨. 개별 UX 항목에 대한 대표님 sign-off는 문서상 분리되어 있지 않음.
2. **SUPER_ADMIN `all` scope** — DL-050에서 허용은 확정됐으나, **기본값·배너·실수 방지 UX**는 spec 초안 수준. RBAC matrix(DL-045)의 “no company filter”와 DL-050의 “explicit header required”가 **문서 간 tension** 존재.
3. **Formula Wizard / Payment Timeline / Settlement Center** — 감사 요청 항목이나 **저장소 내 spec·backlog·DL 부재**. 이름만으로 제품 범위가 암묵적으로 존재하는 상태.
4. **Missing company context → 400** — v1.4.2 구현에서 `COMPANY_CONTEXT_REQUIRED` (400) 채택. GLOBAL_COMPANY_CONTEXT_POLICY는 “400 preferred or 403 per milestone”로 **열려 있었고**, 대표님 명시 승인 기록 없음.
5. **Logout** — `POST /auth/logout`은 **public + `session_id` body** 로 구현됨. DL-043/전략 문서의 HttpOnly cookie 경로는 **DL-049에서 deferred** 로 명시 — 정책 변경은 아니나 **제품 UX(로그아웃 버튼 동작)** 는 아직 미정.

---

## Summary matrix

| # | Feature area | 현재 상태 | 확정 여부 | 대표님 승인 필요 | 위험도 | 구현 여부 |
|---|--------------|-----------|-----------|------------------|--------|-----------|
| 1 | Auth flow | Backend shipped (DL-049) | **DL 확정** | 낮음 (재오픈 시만) | Low | ✅ Backend |
| 2 | Login → Dashboard flow | Spec only (DL-050, Dashboard/Nav specs) | **부분 확정** (DL-050에 묶임) | **Yes** | Medium | ❌ UI |
| 3 | Company Context / Switcher | DL-050 + middleware v1.4.1; filters v1.4.2+ | **정책 확정**, UX 미확정 | **Yes** (UX) | Medium | ⚠️ Backend partial |
| 4 | SUPER_ADMIN `all` scope | DL-050 + middleware | **헤더 정책 확정**, UX/ops 미확정 | **Yes** | **High** | ⚠️ Backend only |
| 5 | `/auth/logout` policy | Body `session_id`, public route | **DL-043/049 + 코드 일치** | Medium (cookie UX) | Low | ✅ Backend |
| 6 | Protected Routes | 47 routes + JWT (DL-049) | **DL 확정** | 낮음 | Low | ✅ Backend |
| 7 | Dashboard V1 | Spec only; KPI APIs exist | **위젯/landing 부분 확정** | **Yes** | Medium | ⚠️ API only |
| 8 | Formula Wizard | **No spec** | **미정** | **Yes** | **High** | ❌ |
| 9 | Payment Timeline | **No spec** | **미정** | **Yes** | **High** | ❌ (API only) |
| 10 | Settlement Center | Nav label + settlement API (DL-033) | **API 정책만 확정** | **Yes** (Center UX) | Medium | ⚠️ API only |

---

## 1. Auth flow

| Field | Detail |
|-------|--------|
| **현재 상태** | Login, refresh, logout, me HTTP routes; JWT 15m + refresh rotation; Argon2id; lockout; bootstrap SUPER_ADMIN. DL-049: Auth **Completed · Production Ready**. Integration gate 308+ (later 320+ with company context tests). |
| **확정 여부** | **확정** — DL-041–DL-049 ACCEPTED; Phase 1–6 closed. |
| **대표님 승인 필요** | **낮음** — 재오픈하지 않는 한 유지. V2 항목(signup, OAuth, cookie refresh, logout-all)은 별도 승인. |
| **위험도** | **Low** — 테스트·CI gate 통과; deferred 항목은 DL-049 §5에 명시. |
| **추천 정책** | 현행 유지. V2(auth cookie, logout-all, signup) 착수 전 **별도 1-page approval**. |
| **구현 여부** | ✅ **Backend 완료** · ❌ Product UI 없음 |

**Audit note:** Spec 문서 일부(`AUTH_TOKEN_SESSION_STRATEGY.md` header)는 “Not started”로 **stale** — implementation은 v1.3.12–v1.3.17에서 완료. 문서 drift이지 무단 확정은 아님.

**Known spec ↔ code gaps (explicitly deferred in DL-049):**

| Topic | Spec intent | Shipped behavior |
|-------|-------------|------------------|
| Refresh transport | HttpOnly cookie | JSON body `refresh_token` |
| Logout transport | Cookie or session id | Body `session_id` required |
| Logout-all | `POST /auth/logout-all` | Not implemented |
| AUTH_ENFORCE env | Production toggle | Not implemented |

---

## 2. Login → Dashboard flow

| Field | Detail |
|-------|--------|
| **현재 상태** | Documented in `DASHBOARD_V1_SPEC.md` §5.1, `NAVIGATION_ARCHITECTURE.md` §6: login → `/auth/me` → company selection (blocking if needed) → navigate to Dashboard → scoped API fetch. **No UI code.** |
| **확정 여부** | **부분 확정** — DL-050 ACCEPTED로 “Dashboard = post-login landing” 및 blocking overlay가 **정책 문서에 포함**됐으나, 대표님 개별 UX sign-off는 분리 기록 없음. |
| **대표님 승인 필요** | **Yes** — landing menu가 Dashboard인지, Formula list인지, last-route인지; blocking overlay vs soft prompt; multi-membership default company. |
| **위험도** | **Medium** — 구현 전 확정하지 않으면 P5 UI rework. |
| **추천 정책** | **승인 전 구현 금지.** 1-page UX decision: (a) default landing route, (b) company selection gate severity, (c) post-login deep-link behavior. |
| **구현 여부** | ❌ **UI 미구현** · ✅ Auth/me API exists |

**Premature-fix flag:** Engineering/docs assumed Dashboard landing via DL-050 bundle — **product choice, not backend requirement.**

---

## 3. Company Context / Company Switcher

| Field | Detail |
|-------|--------|
| **현재 상태** | DL-050: global `request.companyContext`, headers `X-Company-Id` / `X-Company-Scope: all`. **v1.4.1:** middleware (`company-context.ts`). **v1.4.2 (in progress):** service-layer list filters + `requireCompanyContext()` on business list routes. Header switcher **UI not started** (P5). |
| **확정 여부** | **Backend policy 확정** (DL-050). **Switcher UX** (persistence, default, multi-tab) spec-only. |
| **대표님 승인 필요** | **Yes** for UX: switcher placement, persistence (sessionStorage vs server), single global context per session, mandatory header before any business screen. |
| **위험도** | **Medium** — backend fail-closed without UI may block internal testing; wrong UX locks users out. |
| **추천 정책** | Backend: keep DL-050 headers. UI: approve wireframe before P5. Do not add per-menu company pickers (forbidden by DL-050). |
| **구현 여부** | ⚠️ **Middleware ✅** · Service filters **partial/in-flight** · **UI ❌** |

**Premature-fix flag:** v1.4.2 chose **400** for missing company context on list routes without separate product sign-off (policy doc allowed 400 or 403).

**Doc drift:** `GLOBAL_COMPANY_CONTEXT_POLICY.md` §10–§11 still say “Service filtering not started” — update when v1.4.2 lands.

---

## 4. SUPER_ADMIN `all` scope

| Field | Detail |
|-------|--------|
| **현재 상태** | DL-050: only SUPER_ADMIN may send `X-Company-Scope: all`; list/read aggregates skip company filter. Middleware enforces 403 for non-admin `all`. Nav spec: “All companies” label + **visual distinction banner** (design only). |
| **확정 여부** | **Header/API rule 확정** (DL-050). **Default on login (`all` vs last company), write operations in `all` mode, audit requirements** — not product-approved. |
| **대표님 승인 필요** | **Yes** — operational risk: accidental platform-wide view/edit; default scope for SUPER_ADMIN; whether `all` allows mutating routes or read-only. |
| **위험도** | **High** — data exposure and support mistakes. |
| **추천 정책** | Read: `all` allowed with banner. Write: require explicit `X-Company-Id` (fail closed) unless 대표님 approves platform-wide mutations. Default login scope: **company mode** (not `all`) unless approved. |
| **구현 여부** | ⚠️ **Middleware ✅** · RBAC `hasFormulaScope` respects context · **UI banner ❌** |

**Tension:** DL-045 matrix says SUPER_ADMIN “no company filter”; DL-050 requires **explicit** `all` header. DL-050 supersedes for productization — but **RBAC doc header is stale**.

**Premature-fix flag:** Backend implements `all` for both read and write paths today — **write-in-all-mode** should be explicit product decision.

---

## 5. `/auth/logout` policy

| Field | Detail |
|-------|--------|
| **현재 상태** | `POST /api/v1/auth/logout` — **public** (no Bearer). Body: `{ session_id }` required → 400 if missing → revoke session → **204**. Client must retain `session_id` from login response. Refresh reuse still revokes all sessions (DL-043). `logout-all` endpoint **not shipped**. |
| **확정 여부** | **확정** for MVP backend (DL-043 §6, DL-049 §3 public routes). Cookie-based logout **deferred** (DL-049). |
| **대표님 승인 필요** | **Medium** — product logout button: clear tokens + call logout with stored `session_id`; whether logout requires valid access JWT; when to add logout-all in UI. |
| **위험도** | **Low** — session revoke works; access JWT valid ≤15m after logout (accepted in DL-043). |
| **추천 정책** | Keep current API until cookie milestone. UI: on logout, POST `session_id` from login principal, then discard tokens + company context (Nav spec §6). Document in UI spec before P5. |
| **구현 여부** | ✅ **Backend** · ❌ UI |

**Not unauthorized:** Public logout with `session_id` matches DL-049 public route list; differs from cookie-centric **future** UX in AUTH_TOKEN_SESSION_STRATEGY diagram.

---

## 6. Protected Routes

| Field | Detail |
|-------|--------|
| **현재 상태** | DL-046 registry: 48 routes. DL-049: 47 business routes + `GET /auth/me` guarded; `requireRole`, `requireCompanyScope`, `requireFormulaScope` on formula-linked resources. Public: health, login, refresh, logout. |
| **확정 여부** | **확정** (DL-046, DL-049 ACCEPTED). |
| **대표님 승인 필요** | **낮음** — role floors (e.g. cancel/close = COMPANY_ADMIN) already in DL-045/046. Reopen only if business wants MANAGER to cancel. |
| **위험도** | **Low** — extensive integration tests (`protected-routes.integration.test.ts`). |
| **추천 정책** | Maintain DL-046 matrix. New routes must register protection before merge. |
| **구현 여부** | ✅ **Backend complete** |

**Extension (DL-050):** List routes additionally require company context — extends DL-046 stack; not a replacement. `ROUTE_PROTECTION_POLICY.md` implementation line should note v1.4.1+ company context.

---

## 7. Dashboard V1

| Field | Detail |
|-------|--------|
| **현재 상태** | `DASHBOARD_V1_SPEC.md` (v1.4.0, spec only): widgets = unmatched payments, formula KPI, receivable/payable, participant KPI; **same global headers** as other menus; optional client-side roll-up vs future `GET /dashboard/summary`. Backend: dashboard KPI/unmatched **routes exist** from Core MVP; company-scoped filtering added in v1.4.2 trajectory. |
| **확정 여부** | **Partial** — widget **list** and anti-patterns (no dashboard-only filter) in DL-050. **Layout, card metrics, refresh cadence, empty states** not approved. |
| **대표님 승인 필요** | **Yes** — widget priority for v1, aggregate API vs client roll-up, SUPER_ADMIN dashboard in `all` mode, “recent formulas” definition. |
| **위험도** | **Medium** — wrong KPI set drives wrong product narrative. |
| **추천 정책** | Approve **Dashboard v1 wireframe + widget checklist** before P6. Reuse existing API routes; no dashboard-only company filter. |
| **구현 여부** | ⚠️ **API ✅** · scoped aggregation **partial** · **UI ❌** |

**Premature-fix flag:** Spec states Dashboard is **landing menu** — coupled to Login flow (§2); should be one approval package with item #2.

---

## 8. Formula Wizard

| Field | Detail |
|-------|--------|
| **현재 상태** | **No document** in repo: no spec, backlog entry, or DL. Core MVP has **Formula create API** + participant/version rules — not a guided wizard product. |
| **확정 여부** | **미정** — name appears only in this audit request. |
| **대표님 승인 필요** | **Yes (mandatory before any design)** — scope: steps (item, participants, payment, logistics?), draft vs submit, version triggers, role gates. |
| **위험도** | **High** — wizard implies multi-step UX and validation order; easy to conflict with Formula First / version policy if assumed. |
| **추천 정책** | **Do not implement or spec without approval.** If approved, new doc `FORMULA_WIZARD_V1_SPEC.md` + DL entry; map each step to existing APIs only. |
| **구현 여부** | ❌ **None** (API primitives only) |

**Premature-fix flag:** **Highest risk** — any implicit “wizard” assumption in future UI work would be ungoverned.

---

## 9. Payment Timeline

| Field | Detail |
|-------|--------|
| **현재 상태** | **No product spec.** Backend: payment schedules + records APIs, unmatched view, confirmed KPI views. No timeline visualization, ordering rules, or status chip taxonomy documented. |
| **확정 여부** | **미정** |
| **대표님 승인 필요** | **Yes** — what appears on timeline (schedules vs records vs both), cancel/rebook display, formula-scoped vs company-scoped list, timezone/date rules. |
| **위험도** | **High** — finance UX; errors affect trust. |
| **추천 정책** | Separate from Dashboard v1 approval. Start from `GET payments` + unmatched APIs; spec timeline **events model** before UI. |
| **구현 여부** | ❌ **UI none** · ✅ **Payment API** (Core MVP) |

---

## 10. Settlement Center

| Field | Detail |
|-------|--------|
| **현재 상태** | **Backend policy fixed:** DL-033 closed-formula settlement (append payment record/schedule via settlement routes, notes → audit_logs). Nav map lists **Settlement** menu (`NAVIGATION_ARCHITECTURE.md` §3). **No “Settlement Center” product spec** (screens, queues, issue workflow). |
| **확정 여부** | **API/ domain rules 확정** (DL-033). **Center UX** (inbox, filters, assignment) **미정**. |
| **대표님 승인 필요** | **Yes** — Center vs formula-detail settlement tab; which formulas appear (closed only?); integration with Payment Timeline if both exist. |
| **위험도** | **Medium** — DL-033 is strict; UI must not expose forbidden closed-formula edits. |
| **추천 정책** | Treat Settlement Center as **UI shell over DL-033 APIs** — spec allowed operations per formula state before P6. Do not conflate with generic Payment menu. |
| **구현 여부** | ⚠️ **Settlement HTTP routes ✅** · **Center UI ❌** |

---

## Approval queue (next implementation)

Priority order for **대표님 explicit sign-off** before coding:

| Priority | Item | Decision needed |
|----------|------|-----------------|
| P0 | Formula Wizard | Exist? Steps? Draft model? |
| P0 | Payment Timeline | Event model? Scope? |
| P0 | Settlement Center | vs formula detail; queue rules |
| P1 | Login → Dashboard | Landing route; company gate UX |
| P1 | Dashboard V1 | Widget list; aggregate API yes/no |
| P1 | SUPER_ADMIN `all` | Default scope; read vs write in `all`; banner |
| P2 | Company Switcher UX | Persistence; multi-membership defaults |
| P2 | Logout UX | session_id handling; logout-all in UI |
| P3 | Missing context HTTP code | Confirm 400 vs 403 (400 implemented) |

**Safe to continue without new approval (engineering only):**

- Auth bugfixes within DL-049 scope
- Company context service filters completing DL-050 backend (no UX)
- Protected route registration for new APIs per DL-046
- Documentation sync (stale “not started” headers)

---

## Doc / implementation drift register

| Document | Says | Actual (2026-06-23) |
|----------|------|---------------------|
| `AUTH_TOKEN_SESSION_STRATEGY.md` | Implementation not started | Auth shipped v1.3.12–17 |
| `RBAC_PERMISSION_MATRIX.md` | Middleware not started | RBAC shipped v1.3.16–17 |
| `ROUTE_PROTECTION_POLICY.md` | Company context middleware not started | v1.4.1 middleware shipped |
| `GLOBAL_COMPANY_CONTEXT_POLICY.md` | Service filters not started | v1.4.2 in progress |
| `PRODUCTIZATION_V1_PLAN.md` | P4 not started | P4 partially started (v1.4.1+) |
| DL-045 vs DL-050 | SUPER_ADMIN no filter vs explicit `all` header | DL-050 prevails for productization |

Recommend a **doc-only sync batch** after v1.4.2 merge — not a product decision.

---

## References

| ID / Doc | Relevance |
|----------|-----------|
| DL-033 | Closed settlement API rules |
| DL-034 | Core MVP + HTTP |
| DL-043 | JWT / session / logout strategy |
| DL-045 | RBAC matrix |
| DL-046 | Route protection registry |
| DL-049 | Auth complete |
| DL-050 | Global company context |
| `DASHBOARD_V1_SPEC.md` | Dashboard widgets & login flow |
| `NAVIGATION_ARCHITECTURE.md` | Shell, switcher, menus |
| `GLOBAL_COMPANY_CONTEXT_POLICY.md` | Headers, filtering |
| `PRODUCTIZATION_V1_PLAN.md` | P1–P6 phases |

---

## Document history

| Date | Change |
|------|--------|
| 2026-06-23 | v1.0 — Initial feature decision audit (10 areas) |
