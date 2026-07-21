# TOCS Sprint 1 — Implementation Backlog

| Field | Value |
|-------|--------|
| **Version** | v1.0.0 |
| **Sprint** | Sprint 1 — Foundation |
| **Parent plan** | `docs/implementation/TOCS_IMPLEMENTATION_MASTER_PLAN.md` v1.1.0 |
| **Branch baseline** | `tocs-frontend-design` @ `9046d2a` |
| **Gate target** | Gate 2 — Sprint 1 approved |
| **Last updated** | 2026-07-06 |
| **Mode** | Backlog only — no code changes until tasks are individually approved |

**Sprint 1 goal:** Verified working tree, auth/scope shell, repository + API client foundation, formula read/create integration, wizard persist orchestration, mandatory review cycle through Gate 2.

**Closed decision (do not reopen):** Owning Company = Operating Scope (DL-050).

**Out of scope:** Payment, invoice, logistics mutation wiring (Sprint 2–3); mock preview calculation removal without semantic equivalence (Master Plan §6); backend route gaps G1–G4.

---

## Review Gates (global)

| Rule | Enforcement |
|------|-------------|
| No task may begin until **all dependency tasks** pass their Definition of Done |
| **No API wiring** before T2 (repository foundation) and T3 (API client) exist |
| **No mock removal** (preview derivations or mock-data bypass) before **T12** (DTO validation) passes |
| **No Sprint completion** before T13 Typecheck, T14 Build, T15 Cursor Audit, T16 GPT Review, T17 Gate 2 |
| **No backend changes** in Sprint 1 unless a blocking defect is found and explicitly approved |

---

## Dependency Graph

```
T1  Working Tree Verification
         ↓
T2  Repository Layer Foundation
         ↓
T3  API Client Foundation
         ↓
T4  Authentication Shell
         ↓
T5  Operating Scope Context
         ↓
T6  Formula Read API (list)
         ↓
T7  Formula Detail Read API
         ↓
T8  Formula Create API (repository + orchestration contract)
         ↓
T9  Wizard Submit Flow
         ↓
T10 Loading / Error / Empty UX
         ↓
T12 Formula DTO Validation          ← must pass before T11 mock replacement
         ↓
T11 Repository Mock Replacement
         ↓
T13 Typecheck
         ↓
T14 Production Build
         ↓
T15 Cursor Audit
         ↓
T16 GPT Review
         ↓
T17 Gate 2 Readiness
```

**Note on T11 / T12 order:** Task IDs follow implementation layers, but **Review Gates require T12 before T11** for any mock or preview removal. T11 in the execution order below means “complete repository cutover for Sprint 1 surfaces” only after T12 validates DTO mapping.

### Why each dependency exists

| Edge | Reason |
|------|--------|
| T1 → T2 | Cannot safely refactor repository or pages on an unverified tree; accidental deletions block build |
| T2 → T3 | API client must call through repository types; no ad-hoc fetch in components |
| T3 → T4 | Auth login/me require HTTP client + error mapping |
| T4 → T5 | Scope switcher needs `me().companyIds`; unauthenticated scope is invalid for business routes |
| T5 → T6 | Formula list API requires `X-Company-Id` / `X-Company-Scope` on every request (DL-050) |
| T6 → T7 | Detail read reuses list fetch patterns, scope headers, and formula response adapter |
| T7 → T8 | Create flow redirects to Detail; Detail read must work to verify create success |
| T8 → T9 | Wizard submit calls repository orchestration defined in T8 |
| T9 → T10 | UX states wrap wizard/list/detail async paths from T6–T9 |
| T10 → T12 | DTO validation runs against live or recorded API responses from wired flows |
| T12 → T11 | Master Plan §6 — no mock/preview removal until semantic DTO equivalence verified |
| T11 → T13 | Typecheck validates full cutover compiles |
| T13 → T14 | Build is stricter than typecheck (Next.js bundling) |
| T14 → T15 | Cursor audit assumes green build |
| T15 → T16 | GPT/architect review uses audit checklist |
| T16 → T17 | Gate 2 packages review evidence |

---

## Task Backlog

---

### T1 — Working Tree Verification

| Field | Value |
|-------|--------|
| **Task ID** | T1 |
| **Title** | Working Tree Verification |
| **Purpose** | Establish a known-good baseline before any Sprint 1 edits; never restore blindly |
| **Backend dependency** | None |
| **Frontend dependency** | None |
| **Estimated complexity** | **S** |

**Files expected**

- No code changes required if tree is clean
- Optional: `docs/implementation/SPRINT1_BACKLOG.md` (this file) — record verification outcome in Gate 2 packet

**Repository methods** — None

**API routes** — None

**Components** — None

**Definition of Done**

- [ ] Step 1: `git status` captured
- [ ] Step 2: Each changed path compared with HEAD (`git diff`, `git show HEAD:<path>`)
- [ ] Step 3: Each deletion/modification classified (intentional vs accidental)
- [ ] Step 4: Restore from HEAD **only if** accidental loss blocks typecheck/build
- [ ] Verification log appended to sprint notes (paths, decision, action taken)

**Review checklist**

- [ ] No blind `git restore .`
- [ ] Known HEAD-deleted paths documented (e.g. `web/app/formulas/page.tsx`, `web/components/dashboard/formula-mini-row.tsx` if still deleted locally)
- [ ] Branch and commit hash recorded

**Risk:** Restoring intentional local experiments loses work; skipping verification leaves build broken.

**Acceptance criteria**

| | |
|--|--|
| **Complete when** | Tree state documented; blockers for T13/T14 resolved or explicitly accepted |
| **NOT included** | Feature implementation; dependency installs |
| **Verify** | `git status` clean or explained; optional `cd web && npm run build` if tree was restored |
| **Rollback** | N/A — documentation only; restore uses `git restore <path>` per file |

---

### T2 — Repository Layer Foundation

| Field | Value |
|-------|--------|
| **Task ID** | T2 |
| **Title** | Repository Layer Foundation |
| **Purpose** | Extend `web/lib/data/repository.ts` as the sole data seam with Sprint 1 method signatures, scope parameter, and dual-mode (mock/API) switch |
| **Backend dependency** | None (signatures only) |
| **Frontend dependency** | T1 |
| **Estimated complexity** | **M** |

**Files expected**

- `web/lib/data/repository.ts` — extend exports, scope args, orchestration stub
- `web/lib/data/types.ts` or `web/lib/api-types.ts` (if split) — shared request/response types
- `web/lib/data/formula-orchestration.ts` (new) — multi-call create sequence (contract only until T8)

**Repository methods (add or refactor)**

| Method | Notes |
|--------|-------|
| `login`, `me` | Already stubbed; prepare for T4 |
| `listFormulas(scope, query?)` | Scope-first signature |
| `getFormula(scope, id)` | Add scope for header consistency |
| `createFormula(scope, req)` | Single formula row |
| `createFormulaOrchestration(scope, wizardPayload)` | T8 — chains POST formula + participants + schedules + logistics + shares |

**API routes** — Mapped in comments only (no HTTP yet)

**Components** — None

**Definition of Done**

- [ ] All Sprint 1 reads/writes callable through `repository` object
- [ ] Every business method accepts `scope: string` (company id or `"all"` sentinel per policy)
- [ ] `NEXT_PUBLIC_API_MODE=mock|api` or equivalent env switch documented
- [ ] No component-level fetch introduced
- [ ] `formula_no` never accepted on create input

**Review checklist**

- [ ] Single export surface (`repository`)
- [ ] Async Promise return on all methods
- [ ] Write methods do not mutate mock arrays locally

**Risk:** Splitting types across too many files breaks discoverability; orchestration logic leaked into components.

**Acceptance criteria**

| | |
|--|--|
| **Complete when** | Repository compiles; method signatures match backend DTOs in T12 |
| **NOT included** | Real HTTP; payment/invoice methods |
| **Verify** | Import `repository` from a smoke test file; TypeScript resolves all signatures |
| **Rollback** | Revert repository files; pages still on mock-data |

---

### T3 — API Client Foundation

| Field | Value |
|-------|--------|
| **Task ID** | T3 |
| **Title** | API Client Foundation |
| **Purpose** | Central HTTP client: base URL, auth token, company headers, JSON parse, status → typed errors |
| **Backend dependency** | `GET /api/v1/health` (optional smoke); error shape from `src/http/lib/handle-action.js` |
| **Frontend dependency** | T2 |
| **Estimated complexity** | **M** |

**Files expected**

- `web/lib/api/client.ts` (new)
- `web/lib/api/errors.ts` (new) — `ApiError` with status 400/401/403/404/409/423
- `web/lib/api/headers.ts` (new) — `Authorization`, `X-Company-Id`, `X-Company-Scope`
- `.env.local.example` — `NEXT_PUBLIC_API_BASE_URL`

**Repository methods** — Used internally by repository when `api` mode enabled

**API routes** — All routes call through client; Sprint 1 uses auth + formula routes first

**Components** — None

**Definition of Done**

- [ ] `apiClient.get/post/patch/delete` with typed generics
- [ ] 401 triggers auth redirect hook (callback for T4)
- [ ] 409/423 surfaced as user-readable errors
- [ ] Company headers injected from scope context (wired in T5)

**Review checklist**

- [ ] No fetch in components/pages
- [ ] Base URL from env, not hardcoded production URL
- [ ] Credentials/cookies policy documented (Bearer token MVP)

**Risk:** Duplicating error mapping in repository and client; CORS misconfig in local dev.

**Acceptance criteria**

| | |
|--|--|
| **Complete when** | Client unit-tested or manually verified against local Fastify |
| **NOT included** | Token refresh loop (defer unless auth spec requires in Sprint 1) |
| **Verify** | `GET /api/v1/health` returns 200 via client |
| **Rollback** | Set env to mock mode; client unused |

---

### T4 — Authentication Shell

| Field | Value |
|-------|--------|
| **Task ID** | T4 |
| **Title** | Authentication Shell |
| **Purpose** | Login UI, token persistence, session bootstrap via `me`, route guard for business pages |
| **Backend dependency** | `POST /api/v1/auth/login`, `GET /api/v1/auth/me` (`src/http/routes/auth.routes.ts`) |
| **Frontend dependency** | T3 |
| **Estimated complexity** | **L** |

**Files expected**

- `web/app/login/page.tsx` (new)
- `web/components/auth/auth-provider.tsx` (new)
- `web/components/auth/require-auth.tsx` (new)
- `web/app/layout.tsx` — wrap providers
- `web/lib/data/repository.ts` — implement `login`, `me`

**Repository methods**

- `login(req: LoginRequest): Promise<LoginResponse>`
- `me(): Promise<MeResponse>`

**API routes**

| Method | Path |
|--------|------|
| POST | `/api/v1/auth/login` |
| GET | `/api/v1/auth/me` |

**Components**

- `AuthProvider`, `RequireAuth`, login form

**Definition of Done**

- [ ] Unauthenticated user redirected to `/login` for business routes
- [ ] Token stored (memory + sessionStorage or httpOnly cookie per AUTH spec)
- [ ] `me()` loads user id + `companyIds` on app boot
- [ ] 401 from API clears session and redirects
- [ ] Logout stub or full `POST /auth/logout` (optional P1)

**Review checklist**

- [ ] No auth bypass in formula routes
- [ ] RBAC: hide actions later; Sprint 1 only gates authentication
- [ ] Matches `docs/specs/AUTH_RBAC_SPEC.md` transport

**Risk:** Token in localStorage XSS exposure; dev mode friction without running backend.

**Acceptance criteria**

| | |
|--|--|
| **Complete when** | Login → land on Dashboard with valid token; refresh preserves session |
| **NOT included** | Full RBAC matrix UI; password reset |
| **Verify** | Manual login against local API; 401 on expired token |
| **Rollback** | Feature flag `AUTH_ENABLED=false` for mock-only dev |

---

### T5 — Operating Scope Context

| Field | Value |
|-------|--------|
| **Task ID** | T5 |
| **Title** | Operating Scope Context |
| **Purpose** | Wire company switcher to `me().companyIds`; enforce Owning Company = Operating Scope; inject scope into repository |
| **Backend dependency** | `GET /api/v1/auth/me`; company list via memberships (not unscoped client filter) |
| **Frontend dependency** | T4 |
| **Estimated complexity** | **M** |

**Files expected**

- `web/components/company-context.tsx` — replace mock `companies` import
- `web/components/shell/company-switcher.tsx`
- `web/components/shell/all-companies-banner.tsx`
- `web/lib/data/repository.ts` — scope passed to all business calls
- `web/components/wizard/formula-wizard.tsx` — owner locked to `selected.id` (already); verify no owner picker

**Repository methods**

- `listAccessibleCompanies(scope)` — may call `GET /api/v1/companies` scoped or derive from `me`

**API routes**

| Method | Path |
|--------|------|
| GET | `/api/v1/auth/me` |
| GET | `/api/v1/companies` (optional for labels) |

**Components**

- `CompanyProvider`, `CompanySwitcher`, wizard scope guard (`isAllCompanies` block)

**Definition of Done**

- [ ] Switcher lists only companies from `me().companyIds` (+ SUPER_ADMIN all)
- [ ] `X-Company-Id` sent on every business API call when mode = company
- [ ] `X-Company-Scope: all` only when SUPER_ADMIN selects All Companies
- [ ] Wizard creation blocked when `isAllCompanies` (existing UX preserved)
- [ ] No client-side formula filtering as security boundary

**Review checklist**

- [ ] DL-050 compliance documented in PR
- [ ] No `?company_id=` list hacks

**Risk:** Mock company ids (c1, c2) vs UUID mismatch when API connected.

**Acceptance criteria**

| | |
|--|--|
| **Complete when** | Header switch changes scope; repository receives new scope on subsequent calls |
| **NOT included** | Analytics company filter API (Dashboard P2) |
| **Verify** | Network tab shows correct headers per switch |
| **Rollback** | Revert to mock companies with env flag |

---

### T6 — Formula Read API (List)

| Field | Value |
|-------|--------|
| **Task ID** | T6 |
| **Title** | Formula Read API (List) |
| **Purpose** | Wire `repository.listFormulas` to `GET /api/v1/formulas` with scope + query params |
| **Backend dependency** | `listFormulas` action + company scope filter (`src/actions/formula.actions.ts`) |
| **Frontend dependency** | T5 |
| **Estimated complexity** | **M** |

**Files expected**

- `web/lib/data/repository.ts` — API branch for `listFormulas`, `listFormulasInRange`
- `web/lib/api/adapters/formula-adapter.ts` (new) — API response → UI `Formula` type
- `web/app/formulas/page.tsx` — consume repository (restore from HEAD if missing per T1)
- `web/components/formulas/formula-table.tsx`, `formula-card.tsx`, `formula-filters.tsx`

**Repository methods**

- `listFormulas(scope, query?)`
- `listFormulasInRange(scope, args)`

**API routes**

| Method | Path | Query |
|--------|------|-------|
| GET | `/api/v1/formulas` | `trade_status`, `is_closed`, `created_after`, `created_before`, `page`, `page_size` |

**Components**

- Formula list page, table, cards, filters

**Definition of Done**

- [ ] List page loads from repository (API mode)
- [ ] Pagination params mapped if UI supports them (minimum: full first page)
- [ ] Empty list shows empty state (T10 may refine)
- [ ] Mock mode still works via env switch
- [ ] **No mock removal** until T12

**Review checklist**

- [ ] Response adapter handles snake_case API → UI camelCase
- [ ] `formula_no` displayed from API, never client-generated

**Risk:** List response shape thinner than mock `Formula`; Detail tabs may lack nested data until T7.

**Acceptance criteria**

| | |
|--|--|
| **Complete when** | List renders API formulas for scoped company |
| **NOT included** | Dashboard formula widgets; cross-page list |
| **Verify** | Compare list count with backend integration test seed |
| **Rollback** | `NEXT_PUBLIC_API_MODE=mock` |

---

### T7 — Formula Detail Read API

| Field | Value |
|-------|--------|
| **Task ID** | T7 |
| **Title** | Formula Detail Read API |
| **Purpose** | Wire `repository.getFormula` to `GET /api/v1/formulas/:id` (+ nested reads if API returns partial) |
| **Backend dependency** | `getFormulaById` (`src/actions/formula.actions.ts`) |
| **Frontend dependency** | T6 |
| **Estimated complexity** | **L** |

**Files expected**

- `web/lib/data/repository.ts` — `getFormula(scope, id)`
- `web/lib/api/adapters/formula-adapter.ts` — extend for detail shape
- `web/app/formulas/[id]/page.tsx` — repository + async server/client boundary
- `web/components/formulas/formula-detail-view.tsx` — accept loaded formula prop / hook

**Repository methods**

- `getFormula(scope, id)`
- Optional composite: `getFormulaDetail(scope, id)` fetching participants/logistics if separate GETs required

**API routes**

| Method | Path |
|--------|------|
| GET | `/api/v1/formulas/:formulaId` |
| GET | `/api/v1/formulas/:formulaId/participants` (if detail composite) |
| GET | `/api/v1/formulas/:formulaId/logistics` (if detail composite) |
| GET | `/api/v1/formulas/by-formula-no/:formulaNo` (lookup — optional) |

**Components**

- `FormulaDetailPage`, `FormulaDetailView`

**Definition of Done**

- [ ] Detail route resolves formula by id from API
- [ ] 404 → not-found UI (existing pattern)
- [ ] Nested tabs receive data from repository sub-calls or bundled adapter
- [ ] Preview KPI methods (`getFormulaConfirmedKpi`, etc.) remain mock/preview until Sprint 2+ equivalence check

**Review checklist**

- [ ] No direct `getFormula` from `mock-data` in `[id]/page.tsx`
- [ ] Formula First: all data keyed by `formula_id`

**Risk:** API detail response lacks mock-nested schedules/records; tabs may show empty until later sprints.

**Acceptance criteria**

| | |
|--|--|
| **Complete when** | Navigate list → detail shows API-backed header + overview fields |
| **NOT included** | Live KPI view wiring; mutation tabs |
| **Verify** | Open known formula id from integration test |
| **Rollback** | Mock mode env flag |

---

### T8 — Formula Create API

| Field | Value |
|-------|--------|
| **Task ID** | T8 |
| **Title** | Formula Create API |
| **Purpose** | Implement repository create + orchestration calling backend sequence for wizard payload |
| **Backend dependency** | Formula, participant, payment schedule, logistics, share, version routes |
| **Frontend dependency** | T7 |
| **Estimated complexity** | **XL** |

**Files expected**

- `web/lib/data/formula-orchestration.ts`
- `web/lib/data/repository.ts` — `createFormula`, `createFormulaOrchestration`
- `web/lib/api/adapters/wizard-to-api.ts` (new) — WizardState → API DTOs
- `web/lib/api/adapters/version-payload-builder.ts` (new) — snapshot + calculation for version-trigger steps

**Repository methods**

| Method | Backend calls |
|--------|---------------|
| `createFormula` | `POST /api/v1/formulas` |
| `createFormulaOrchestration` | POST formula → POST participants (each + version) → POST payment-schedules → POST logistics (+ version) → POST shares (+ version) |

**API routes**

| Method | Path |
|--------|------|
| POST | `/api/v1/formulas` |
| POST | `/api/v1/formulas/:id/participants` |
| POST | `/api/v1/formulas/:id/payment-schedules` |
| POST | `/api/v1/formulas/:id/logistics` |
| POST | `/api/v1/formulas/:id/shares` |
| POST | `/api/v1/formulas/:id/versions` (via participant/share/logistics payloads) |

**Components** — None directly (called from T9)

**Definition of Done**

- [ ] Orchestration transactional UX: partial failure returns explicit error + no fake success
- [ ] `item_id` UUID sent (seed mapping from `web/lib/items.ts` until Item API — G8)
- [ ] `formula_no` returned from API only
- [ ] Version payloads included for participant/logistics/share per backend contract
- [ ] Rollback policy documented (orphan formula if step 2 fails — user message + support path)

**Review checklist**

- [ ] No version-trigger fields on formula PATCH
- [ ] `toPrismaTradeType` used for `trade_type`
- [ ] Closed formula guards not applicable on create

**Risk:** Version payload incorrect → 400/409; orchestration order wrong → sequence conflicts; Item UUID mismatch (G8).

**Acceptance criteria**

| | |
|--|--|
| **Complete when** | Single orchestration call creates formula + minimum viable chain in API mode |
| **NOT included** | Idempotent retry; draft save |
| **Verify** | POST creates row in DB; GET detail returns new id |
| **Rollback** | Disable orchestration; wizard shows error, no redirect |

---

### T9 — Wizard Submit Flow

| Field | Value |
|-------|--------|
| **Task ID** | T9 |
| **Title** | Wizard Submit Flow |
| **Purpose** | Replace `setTimeout` redirect with repository orchestration, success redirect to Detail |
| **Backend dependency** | T8 orchestration |
| **Frontend dependency** | T8 |
| **Estimated complexity** | **M** |

**Files expected**

- `web/components/wizard/formula-wizard.tsx`
- `web/app/formulas/new/page.tsx`
- `web/components/wizard/types.ts` — validation unchanged unless DTO gaps found

**Repository methods**

- `createFormulaOrchestration(scope, payload)`

**API routes** — Same as T8

**Components**

- `FormulaWizard`, `StepReview`, `FormulaPreview`

**Definition of Done**

- [ ] "Create Formula" calls repository (not setTimeout)
- [ ] `submitting` state blocks double submit
- [ ] Success → `router.push(/formulas/{id})`
- [ ] Failure → inline error on Review step with server message
- [ ] `canCreate` gate still uses `getWizardIssues`

**Review checklist**

- [ ] Owning company = `selected.id` from scope context
- [ ] All Companies scope still blocked

**Risk:** User waits on long orchestration chain; partial failure UX unclear.

**Acceptance criteria**

| | |
|--|--|
| **Complete when** | End-to-end wizard create lands on Detail with real id |
| **NOT included** | Edit formula; wizard draft |
| **Verify** | Complete wizard with minimal valid chain |
| **Rollback** | Feature flag disables submit → show maintenance message |

---

### T10 — Loading / Error / Empty UX

| Field | Value |
|-------|--------|
| **Task ID** | T10 |
| **Title** | Loading / Error / Empty UX |
| **Purpose** | Standardize async states for list, detail, wizard, login |
| **Backend dependency** | None (UI only) |
| **Frontend dependency** | T9 |
| **Estimated complexity** | **M** |

**Files expected**

- `web/components/ui/loading-state.tsx` (new)
- `web/components/ui/error-state.tsx` (new)
- `web/components/ui/empty-state.tsx` (new)
- `web/app/formulas/page.tsx`, `web/app/formulas/[id]/page.tsx`, `web/app/login/page.tsx`, `formula-wizard.tsx`

**Repository methods** — None new

**API routes** — None

**Components**

- Shared loading/error/empty primitives + integration in Sprint 1 surfaces

**Definition of Done**

- [ ] List: loading skeleton, empty list, error retry
- [ ] Detail: loading, 404, error retry
- [ ] Wizard: submitting overlay, validation errors, API error banner
- [ ] Login: invalid credentials message maps 401

**Review checklist**

- [ ] Accessible (`aria-busy`, role=alert on errors)
- [ ] No silent failures

**Risk:** Inconsistent patterns if not using shared components.

**Acceptance criteria**

| | |
|--|--|
| **Complete when** | Simulated slow network + error responses show correct UI |
| **NOT included** | Toast system; global error boundary (optional) |
| **Verify** | Throttle network in devtools |
| **Rollback** | Remove shared components; inline spinners |

---

### T11 — Repository Mock Replacement

| Field | Value |
|-------|--------|
| **Task ID** | T11 |
| **Title** | Repository Mock Replacement |
| **Purpose** | Remove direct `mock-data` imports from Sprint 1 scope pages; repository is sole read path. **Do not remove preview derivations until T12 passes.** |
| **Backend dependency** | T6, T7, T8 API paths stable |
| **Frontend dependency** | **T12** (mandatory gate) |
| **Estimated complexity** | **M** |

**Files expected (migrate off mock-data imports)**

| File | Current import |
|------|----------------|
| `web/app/formulas/[id]/page.tsx` | `getFormula` |
| `web/app/formulas/page.tsx` | formulas list |
| `web/components/company-context.tsx` | `companies` |
| `web/components/wizard/steps.tsx` | `companies`, `registeredCompanies` |

**Files explicitly NOT in Sprint 1 cutover**

- `web/app/page.tsx` (Dashboard — Sprint 5)
- `web/components/formulas/detail-panels.tsx` (mutation tabs — Sprint 2+)
- `web/lib/formula-math.ts` preview — keep until equivalence (Master Plan §6)

**Repository methods** — All Sprint 1 reads route through repository

**API routes** — Already wired in T6–T8

**Components** — List, Detail, Wizard steps, Company context

**Definition of Done**

- [ ] Zero direct `@/lib/mock-data` imports in Sprint 1 scope files above
- [ ] `repository` default mode = API when env set
- [ ] Mock mode retained behind flag for offline UI dev
- [ ] Preview KPI functions still labeled PREVIEW in repository

**Review checklist**

- [ ] T12 sign-off attached
- [ ] No accidental deletion of `mock-data.ts` (still used by Dashboard)

**Risk:** Removing mock too early breaks Dashboard; partial adapter causes silent field loss.

**Acceptance criteria**

| | |
|--|--|
| **Complete when** | Sprint 1 pages compile and run API-only in staging |
| **NOT included** | Dashboard mock removal; derive* removal |
| **Verify** | Grep `@/lib/mock-data` in scope files = 0 |
| **Rollback** | Restore imports; env mock mode |

---

### T12 — Formula DTO Validation

| Field | Value |
|-------|--------|
| **Task ID** | T12 |
| **Title** | Formula DTO Validation |
| **Purpose** | Verify API response/request mapping matches backend engine semantics before mock cutover |
| **Backend dependency** | Integration test fixtures; live API sample responses |
| **Frontend dependency** | T10 (wired flows produce real payloads) |
| **Estimated complexity** | **M** |

**Files expected**

- `web/lib/api/adapters/formula-adapter.ts`
- `web/lib/api/adapters/wizard-to-api.ts`
- `web/lib/prisma-mapping.ts` — enum spot checks
- `docs/implementation/SPRINT1_DTO_VALIDATION.md` (new) — comparison log

**Repository methods** — Validated: `listFormulas`, `getFormula`, `createFormulaOrchestration`

**API routes** — All T6–T8 routes

**Components** — None

**Validation matrix (minimum)**

| Field / rule | Backend source | UI adapter |
|--------------|----------------|------------|
| `item_id` | `CreateFormulaRequest.item_id` | wizard `itemId` / seed map |
| `trade_type` | Prisma enum | `toPrismaTradeType` |
| `formula_no` | DB generated | read-only display |
| Six status enums | snake_case API | `prisma-mapping` |
| List pagination | `ListFormulasQuery` | UI filters |
| Scope | `X-Company-Id` | company context |

**Definition of Done**

- [ ] Side-by-side checklist documented (API JSON vs UI type)
- [ ] Known gaps listed (nested mock fields not in API list response)
- [ ] Sign-off that no semantic divergence on mapped fields
- [ ] Blocks T11 until pass

**Review checklist**

- [ ] No `item` string sent where backend expects `item_id`
- [ ] No client-assigned `formula_no`

**Risk:** Approving validation with unmapped fields causes production UI bugs.

**Acceptance criteria**

| | |
|--|--|
| **Complete when** | `SPRINT1_DTO_VALIDATION.md` complete with PASS/WAIVED per field |
| **NOT included** | KPI view equivalence (Sprint 2+) |
| **Verify** | Record API responses from `formula.integration.test.ts` seed |
| **Rollback** | N/A — documentation gates T11 |

---

### T13 — Typecheck

| Field | Value |
|-------|--------|
| **Task ID** | T13 |
| **Title** | Typecheck |
| **Purpose** | Zero TypeScript errors in Sprint 1 scope |
| **Backend dependency** | None |
| **Frontend dependency** | T11 |
| **Estimated complexity** | **S** |

**Files expected** — All modified `web/**` files

**Repository methods** — N/A

**API routes** — N/A

**Components** — N/A

**Definition of Done**

- [ ] `cd web && npx tsc --noEmit` passes (or project equivalent)
- [ ] No `@ts-ignore` added without waiver comment

**Review checklist**

- [ ] Strict types on adapters
- [ ] No `any` on API responses without zod/manual guard (document if deferred)

**Risk:** Next.js 16 + React 19 strict props mismatches.

**Acceptance criteria**

| | |
|--|--|
| **Complete when** | tsc exit code 0 |
| **NOT included** | Backend root tsc unless monorepo script exists |
| **Verify** | CI command recorded in Gate 2 packet |
| **Rollback** | Fix forward only |

---

### T14 — Production Build

| Field | Value |
|-------|--------|
| **Task ID** | T14 |
| **Title** | Production Build |
| **Purpose** | Next.js production build green |
| **Backend dependency** | None |
| **Frontend dependency** | T13 |
| **Estimated complexity** | **S** |

**Files expected** — `web/package.json` scripts unchanged unless fix required

**Command:** `cd web && npm run build`

**Definition of Done**

- [ ] `npm run build` exit 0
- [ ] No missing page modules (formulas list restored if required per T1)

**Review checklist**

- [ ] Static/dynamic routes compile
- [ ] Env vars documented for build-time `NEXT_PUBLIC_*`

**Risk:** Deleted `formulas/page.tsx` breaks build.

**Acceptance criteria**

| | |
|--|--|
| **Complete when** | Build artifact succeeds |
| **NOT included** | Deploy to production |
| **Verify** | Local build log archived |
| **Rollback** | Revert breaking commit |

---

### T15 — Cursor Audit

| Field | Value |
|-------|--------|
| **Task ID** | T15 |
| **Title** | Cursor Audit |
| **Purpose** | Automated + manual compliance with TOCS core rules for Sprint 1 diff |
| **Backend dependency** | None |
| **Frontend dependency** | T14 |
| **Estimated complexity** | **S** |

**Audit checklist**

- [ ] Formula First — no Deal/Order/Project entities
- [ ] No manual `formula_no` assignment
- [ ] No version-trigger fields on formula PATCH from UI
- [ ] Layer discipline — Component → repository → client
- [ ] Scope headers on business calls
- [ ] Owning Company = Operating Scope — no owner picker added
- [ ] No backend files changed without approval
- [ ] No new npm deps without report
- [ ] Workflow Re-Audit for Sprint 1 scope documented
- [ ] Engine Impact Recheck for create + read documented
- [ ] No Formula First violation
- [ ] Backend semantics preserved

**Definition of Done**

- [ ] Checklist completed and attached to Gate 2 packet
- [ ] All FAIL items resolved or waived with approval

**Risk:** Cursor rule §15 still forbids API wiring — requires Gate 1 cursor milestone update.

**Acceptance criteria**

| | |
|--|--|
| **Complete when** | All checklist items PASS or waived |
| **NOT included** | Full-repo audit beyond Sprint 1 diff |
| **Verify** | Audit doc in `docs/implementation/` |
| **Rollback** | N/A |

---

### T16 — GPT Review

| Field | Value |
|-------|--------|
| **Task ID** | T16 |
| **Title** | GPT Review |
| **Purpose** | Architect/stakeholder review of Sprint 1 deliverables before Gate 2 |
| **Backend dependency** | None |
| **Frontend dependency** | T15 |
| **Estimated complexity** | **S** |

**Inputs**

- Sprint 1 diff summary
- T12 DTO validation doc
- T15 Cursor audit
- Manual test notes (login, list, detail, create)

**Definition of Done**

- [ ] Review feedback recorded
- [ ] Blocking issues → fix tasks or waivers
- [ ] Non-blocking issues → backlog

**Review checklist**

- [ ] Backend Semantics Preservation principle upheld
- [ ] Mock removal policy followed (§6 Master Plan)
- [ ] Mandatory Review Cycle complete

**Risk:** Review skipped under schedule pressure.

**Acceptance criteria**

| | |
|--|--|
| **Complete when** | Written approval or conditional approval with explicit conditions |
| **NOT included** | Gate 3 payment scope |
| **Verify** | Sign-off email/thread linked in Gate 2 packet |
| **Rollback** | N/A |

---

### T17 — Gate 2 Readiness

| Field | Value |
|-------|--------|
| **Task ID** | T17 |
| **Title** | Gate 2 Readiness |
| **Purpose** | Package evidence that Sprint 1 Exit Gate and Gate 2 criteria are met |
| **Backend dependency** | Backend integration tests green (recommended) |
| **Frontend dependency** | T16 |
| **Estimated complexity** | **S** |

**Gate 2 exit criteria (from Master Plan)**

- [ ] Sprint 1 DoD complete
- [ ] Sprint Exit Gate: Typecheck, Build, Workflow Audit, Engine Impact Audit, Formula First Audit
- [ ] Auth/scope/read/create shell ready
- [ ] Mandatory Review Cycle completed

**Deliverable**

- `docs/implementation/SPRINT1_GATE2_PACKET.md` (new) containing:
  - Commit hash
  - T1 verification log
  - T12 validation summary
  - T13/T14 command output
  - T15/T16 sign-offs
  - Known gaps deferred to Sprint 2
  - E2E create flow screenshot or recording link

**Definition of Done**

- [ ] Gate 2 packet published
- [ ] Stakeholder approval recorded
- [ ] `.cursor/rules/tocs-core.mdc` §15 milestone update ticket created (if not done at Gate 1)

**Risk:** Declaring Gate 2 with Dashboard still on mock is correct — document explicitly.

**Acceptance criteria**

| | |
|--|--|
| **Complete when** | Gate 2 approved; Sprint 2 may start |
| **NOT included** | Payment mutations |
| **Verify** | Master Plan Gate 2 table satisfied |
| **Rollback** | Remain on Sprint 1 for open blockers |

---

## Sprint 1 Acceptance Criteria (summary)

| Criterion | Verification |
|-----------|--------------|
| User can log in | T4 manual test |
| Scope switcher drives API headers | T5 network inspection |
| Formula list from API | T6 |
| Formula detail from API | T7 |
| Wizard creates formula via orchestration | T9 + T8 |
| No direct mock-data in Sprint 1 scope pages | T11 grep |
| DTO mapping validated | T12 doc |
| Typecheck + build green | T13, T14 |
| Audits complete | T15, T16 |
| Gate 2 approved | T17 |

**Explicitly NOT in Sprint 1**

- Payment, invoice, logistics mutation UI
- Dashboard/Reports API transition
- Cancel/Close execute wiring
- Removal of `formula-math.ts` preview derivations without equivalence
- Backend route gaps G1–G4 implementation
- Item API (G8) — use seed UUID strategy documented in T12

---

## Conflict Register (Sprint 1 backlog)

| Conflict | Resolution in this backlog |
|----------|----------------------------|
| User task list orders T11 before T12 | Execution order adjusted: **T12 before T11** per Review Gates and Master Plan §6 |
| Cursor rule forbids API wiring | Gate 1 / Gate 2 requires cursor milestone update |
| API list response thinner than mock Detail | T7 may compose multiple GETs; T12 documents gaps |
| `CreateFormulaRequest.item` vs `item_id` | T12 validation; wizard uses `itemId` + seed map (G8) |
| `web/app/formulas/page.tsx` deleted locally | T1 decides restore; T14 requires page for build |

---

*End of Sprint 1 Backlog — ready for task-by-task execution after Gate 1 approval.*
