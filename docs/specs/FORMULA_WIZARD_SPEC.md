# TOCS Formula Wizard — Core Design (Minimal Spec)

## Document status

| Field | Value |
|-------|--------|
| **Version** | v1.5.9 (Specification + **screen wireframe** — Step Navigation · Review edit links) |
| **Status** | DRAFT — §12 A–C · §14 #5 **Pending**; **Draft Deferred** (§2.6) |
| **Implementation** | **Not started** — UI in P6+; **no backend/API/DB changes** |

**Related:** [`GLOBAL_COMPANY_CONTEXT_POLICY.md`](./GLOBAL_COMPANY_CONTEXT_POLICY.md), [`DASHBOARD_V1_SPEC.md`](./DASHBOARD_V1_SPEC.md), [`NAVIGATION_ARCHITECTURE.md`](./NAVIGATION_ARCHITECTURE.md), [`../api/TOCS_API_SPEC_v1.1.md`](../api/TOCS_API_SPEC_v1.1.md), [`../api/API_MVP_SCOPE.md`](../api/API_MVP_SCOPE.md), [`FEATURE_DECISION_AUDIT.md`](./FEATURE_DECISION_AUDIT.md)

**Prerequisite (shipped):** Core MVP Formula/Participant/Payment/Logistics HTTP routes; Global Company Context (DL-050, v1.4.2).

---

## 1. Purpose

The **Formula Wizard** is a **guided input UX** for creating a new Formula. It **does not** introduce a new domain entity, ledger, or calculation engine.

| Rule | Detail |
|------|--------|
| **Formula = ledger** | Wizard output is always one `formulas` row + related child rows |
| **Formula 1 = Item 1** | Exactly one `item_id` per Formula (Step 1) |
| **API composition only** | Wizard calls existing Core HTTP routes in a defined order |
| **No duplicate input** | Fields captured once; downstream steps inherit (§3) |
| **Review before persist** | Step 6 is mandatory; no silent auto-save to backend |
| **Global company context** | Active company (`X-Company-Id`) **must** appear as a participant (§2.2) |

Quick Action "Formula 생성" (Dashboard) and `/app/formulas/new` **should use this Wizard** once UI is implemented.

---

## 2. Architecture constraints

### 2.1 Formula First (non-negotiable)

- No `Deal`, `Order`, `Project`, or parallel business root.
- Wizard never writes `formula_no` — DB `generate_formula_no()` only.
- Role is on `formula_participants.role_group`, not on `companies`.

### 2.2 Global Company Context

| Rule | Detail |
|------|--------|
| **Active company required** | Wizard opens only when `request.companyContext.mode = company` with valid `companyId` |
| **Participant inclusion** | `companyId` from Header Company Switcher **must** be assigned to ≥1 participant in Step 2 |
| **Role visibility** | UI must show which `role_group` / sequence the active company holds (e.g. 매출처, 매입처, 운송) |
| **SUPER_ADMIN `all` scope** | Wizard **must not** run under `X-Company-Scope: all` — user selects a company first (same as other create flows) |

### 2.3 No duplicate input

| Field | Single source | Wizard rule |
|-------|---------------|-------------|
| `quantity` | Step 1 → `POST /formulas` | Step 2 participant `quantity` **omit** (API inherits `formulas.quantity`) |
| `unit` | Step 1 | Do not re-ask on participant rows |
| `item_id` | Step 1 | One item only |
| `total_buy_amount` / `total_sell_amount` | DB GENERATED | **Display only** in Step 3/6 — never send in API body |
| `buy_unit_price` / `sell_unit_price` | Step 3 per participant | One entry per participant line |
| Logistics cost | Step 5 only | Do not re-enter in payment steps as “운송비 예정” duplicate unless linked via schedule memo |

### 2.4 Calculation policy (Wizard preview)

- Wizard **profit preview** uses **Estimated Net Profit** only — see **§2.5 (confirmed terminology)**.
- Preview aligns with `v_formula_profit_engine` / latest `formula_calculation_snapshots` / `GET .../kpi/expected` — **not** bank-confirmed cash.
- **Before save (Step 6):** client-side preview only; UI label **must** use **Estimated Net Profit (예상 순이익)** or equivalent — never **Realized Net Profit**.
- **After save:** optional read **Estimated** via `GET /api/v1/formulas/{id}/kpi/expected` — no new KPI API.
- **Realized Net Profit** in Wizard steps — **§12 C / §14 #3 Pending**; **must not** substitute for or mix with Estimated (§2.5).

### 2.5 Profit terminology — **confirmed policy**

Two metrics are **defined and distinct**. **Do not conflate labels, formulas, or UI copy.**

#### Estimated Net Profit (예상 순이익)

| Field | Rule |
|-------|------|
| **Definition** | 예상 매출 − 예상 매입 − 예상 비용 − 예상 Share |
| **Basis** | Formula engine / snapshot — expected values, not bank cash |
| **Formula creation / Wizard** | **May display** — Step 3 / Step 6 preview (§2.4) |
| **Formula Detail** | **May display** |
| **Formula Preview** | **May display** |
| **Dashboard** | **Excluded** — `DASHBOARD_V1_SPEC.md` §4.4 |
| **Company scope** | **May aggregate** per active company context (non-Dashboard surfaces) |
| **API reference (existing)** | `GET .../kpi/expected` → `expected_net_profit` (per Formula); company roll-up via scoped queries — no new API |

#### Realized Net Profit (실현 순이익)

| Field | Rule |
|-------|------|
| **Definition** | 실제 입금 − 실제 출금 − 실제 비용 − 확정 Share |
| **Basis** | **Payment Record** — confirmed bank movements |
| **Formula creation / Wizard** | **Not** the Wizard preview metric; **§12 C Pending** for any Wizard exposure |
| **Dashboard** | **May display** **Realized Net Profit** only (P0 + loss §4.5) — `DASHBOARD_V1_SPEC.md` §4.4 |
| **Company scope** | **May aggregate** per active company context |
| **API reference (existing)** | `GET .../kpi/confirmed` → confirmed net profit (per Formula); no new API |

#### Mixing rule (non-negotiable)

```
Estimated Net Profit  ≠  Realized Net Profit
```

| Forbidden | Reason |
|-----------|--------|
| Same card/label for both | User cannot distinguish expected vs cash |
| Showing Realized value under “예상” / Estimated label | Violates definition |
| Showing Estimated value under “실현” / Realized label | Violates definition |
| Using `kpi/confirmed` for Wizard Step 3/6 preview | Wrong basis |

**Deprecated product terms (do not use in new copy):** “계산상 이익”, “확정 이익” as standalone KPI names — map to **Estimated** or **Realized** per table above.

### 2.6 Draft policy — **confirmed (Deferred from V1)**

| Field | Policy |
|-------|--------|
| **Status** | **Deferred** |
| **V1 scope** | **Excluded** |

#### V1 Wizard — not in scope

| Capability | V1 |
|------------|-----|
| Draft 저장 (persisted draft) | **No** |
| Auto Save | **No** |
| Resume Flow (중단 후 이어하기) | **No** |
| Draft 목록 | **No** |
| Draft 만료 정책 | **No** |

#### Runtime behavior (V1)

- Wizard state lives **in-memory** in the active browser tab/session only (§8 `FormulaWizardDraft`).
- User leaves Wizard or closes tab **before Step 6 Confirm** → state **discarded**; no recovery UX.
- **No** partial backend Formula create for “draft” purposes (§3).
- Optional **browser leave warning** (unsaved changes) is UX-only — **not** Draft persistence.

#### Reason

| Driver | Detail |
|--------|--------|
| **Formula lifecycle** | Draft entities would add incomplete Formula states, cleanup, RBAC, and audit edge cases |
| **Productization V1** | Minimize Wizard scope — Step 6 single commit (§7) |

#### Deferred ≠ permanent exclusion

**Deferred** means **not V1** — **not** a ban on future work. **V2+** may revisit client-side persist, server Draft, or staged commit under a **separate spec / DL / API·schema approval** (§10).

**Naming note:** §8 `FormulaWizardDraft` is an **in-session TypeScript shape** only — **not** the product “Draft” feature deferred here.

---

## 3. Wizard flow overview

```
Step 1 기본 정보 → Step 2 참여 회사 → Step 3 금액 → Step 4 입출금 예정
    → Step 5 물류 → Step 6 검토 → [Confirm] → sequential Core API calls
```

| Phase | Backend touch | When |
|-------|---------------|------|
| Steps 1–5 | **None** | Client-side wizard state only |
| Step 6 | **Read-only summary** | Still no backend until user confirms |
| Confirm | **Existing POST APIs** | Ordered commit sequence (§7) |

**Screen wireframe:** **§15** (normative layout; Step Navigation §15.2; Review edit §15.3.6). Step order in §3 remains logical draft; wireframe steps 1–6 match §4.

**Forbidden:** Partial backend create before Step 6 confirm (§2.6 — no Draft / staged save in V1).

---

## 4. Step specifications

### Step 1 — 기본 정보

| UI field | Maps to API | Route (on commit) |
|----------|-------------|-------------------|
| 품목 | `item_id` | `POST /api/v1/formulas` |
| 단위 | `unit` | same |
| 수량 | `quantity` | same |
| 내용 / 메모 | `content`, `note` | same |

| Rule | Detail |
|------|--------|
| Trade type | Default `DOMESTIC` for Wizard v1 unless product extends |
| `formula_no` | Never shown as editable |
| Validation | Same as Formula create validation (quantity > 0, item active) |

---

### Step 2 — 참여 회사

| UI slot | Purpose | Maps to `formula_participants` |
|---------|---------|--------------------------------|
| 매입처 | Supplier line | `role_group` = supplier-side enum (e.g. `SUPPLIER`) |
| 매출처 | Buyer line | `role_group` = buyer-side enum (e.g. `BUYER`) |
| 운송사 (optional) | Carrier participant | Company linked; may overlap with Step 5 logistics `carrier_company_id` |

| Rule | Detail |
|------|--------|
| **Active company** | Global `companyId` **must** appear on ≥1 row |
| **Role clarity** | Each row shows: company name, `role_group`, `sequence_order`, start/end point flags |
| **Sequence** | Assign `sequence_order` 1..N **before commit** — MVP has no order-swap API |
| **Start / end point** | At most one `is_start_point` and one `is_end_point` per Formula |
| **Same company twice** | Allowed by schema (no UNIQUE on `company_id`) — UI should warn, not block silently |
| **New company** | Optional link to Company register (`POST /companies`) in separate flow — not embedded duplicate register in Wizard |

Prices are **not** required in Step 2; they are Step 3 (commit merges into participant POST).

---

### Step 3 — 금액

Per participant row from Step 2:

| UI field | API field | Rule |
|----------|-----------|------|
| 매입 단가 | `buy_unit_price` | Version-triggering |
| 매출 단가 | `sell_unit_price` | Version-triggering |
| 총매입 | `total_buy_amount` | **Read-only** (GENERATED) |
| 총매출 | `total_sell_amount` | **Read-only** (GENERATED) |
| Estimated Net Profit (예상 순이익) | Preview | §2.5; client: Σ sell − Σ buy − expected cost − expected share (Step 5 logistics when entered) |

**부가세 (VAT) display rule (UI-only, no new column):**

| Rule | Detail |
|------|--------|
| Basis | State explicitly whether unit prices are **VAT-inclusive** or **VAT-exclusive** |
| Default | Product default must be fixed in UI copy (approval: see §12 Invoice overlap) |
| API | No VAT field on Formula/Participant — display/label only |

---

### Step 4 — 입출금 예정

| UI concept | Maps to API | Route (on commit) |
|------------|-------------|-------------------|
| 입금 예정 | `direction: IN` schedule | `POST /api/v1/formulas/{id}/payment-schedules` |
| 출금 예정 | `direction: OUT` schedule | same |
| 선입금 / 잔금 / 외상 | `payment_type` + split rows | Multiple schedule POSTs allowed |
| 분할 입력 | Multiple schedules | One POST per schedule row |

| Rule | Detail |
|------|--------|
| `participant_id` | Required when schedule ties to a participant line |
| `scheduled_amount` | > 0 |
| **Actual cash** | **Not created here** — use Payment module + `payment-records` after Formula exists |
| Closed Formula | N/A at create time |
| Step optional | User may skip Step 4 and add schedules later in Payment menu |

---

### Step 5 — 물류

| UI field | Maps to API | Route (on commit) |
|----------|-------------|-------------------|
| 운송사 | `carrier_company_id` | `POST /api/v1/formulas/{id}/logistics` |
| 운송비 | `total_logistics_cost` | same — **Version-triggering** |
| 비용 부담 주체 | `cost_bearer_company_id` | Required if `total_logistics_cost > 0` |
| 출발/도착 회사·장소 | `departure_*`, `arrival_*` | Optional per API |
| `cost_type` | `INCLUDED_IN_BUY_PRICE` / `INCLUDED_IN_SELL_PRICE` / `SEPARATE_COST` | User must pick one |

**물류비 ↔ 이익 반영 (display copy for Step 5/6):**

| `cost_type` | Meaning for **Estimated Net Profit** preview |
|-------------|----------------------------|
| `SEPARATE_COST` | Expected logistics cost reduces **Estimated Net Profit** in engine (snapshot `expected_cost`) |
| `INCLUDED_IN_BUY_PRICE` | Cost embedded in buy side — do not double-count in UI preview |
| `INCLUDED_IN_SELL_PRICE` | Cost embedded in sell side — do not double-count |

**Actual logistics payment:** `total_logistics_cost` is **plan value** only. Real `OUT` payment record is **post-Wizard** (Payment module).

Step optional if no logistics.

---

### Step 6 — 검토 (mandatory)

Read-only summary before confirm:

| Section | Content |
|---------|---------|
| Formula 기본 정보 | Step 1 fields |
| 참여자 | Step 2 + Step 3 merged table |
| 금액 | Totals, VAT basis note, **Estimated Net Profit** preview (저장 전) |
| 예정 입출금 | Step 4 schedule list |
| 물류비 | Step 5 summary + cost_type explanation |
| **예상 이익** | **Estimated Net Profit** preview label; post-save `kpi/expected` link |

| Action | Behavior |
|--------|----------|
| **Back** | Edit prior steps without API calls |
| **Confirm / 저장** | Execute commit sequence (§8) |
| **Cancel** | Discard wizard state |

---

## 5. Version & Snapshot policy (Wizard)

Wizard **must not** call `POST /versions` directly. Version artifacts are created by **existing write paths** when version-triggering fields change.

### 5.1 When Version + Snapshot are created (on commit)

| Commit action | Version triggered? | Notes |
|---------------|:------------------:|-------|
| `POST /formulas` | **No** | Formula shell only |
| `POST .../participants` (with prices) | **Yes** | Each participant create with `buy_unit_price` / `sell_unit_price` / `quantity` per Service policy |
| `POST .../payment-schedules` | **No** | Schedules are not version-triggering |
| `POST .../logistics` (with `total_logistics_cost`) | **Yes** | Logistics cost change policy |
| `POST .../shares` | **Yes** | **Out of Wizard v1** unless §12 approved |

Each Version creates `formula_versions` + `formula_calculation_snapshots` + `audit_logs` per existing Service rules (not Wizard logic).

### 5.2 When Version is **not** created

- Formula POST alone
- Payment schedule POST alone
- Review step (Step 6) display only
- Preview calculations before confirm

### 5.3 Wizard must not

- Manually assign `version_no`
- Update old snapshots
- Bypass VersionService for version-triggering fields

---

## 6. Out of scope — Wizard does **not** create

These remain **separate modules** after Formula exists:

| Action | Correct module / API |
|--------|----------------------|
| 실제 입금 / 출금 | `POST .../payment-records` (Payment) |
| 계산서 발행 | `POST .../invoices` (Invoice) |
| 정산 확정 | Settlement flows (DL-033) |
| Close | Close API |
| Cancel | `POST .../cancel` |
| Reopen | V2 — not MVP |
| Undo close / undo cancel | V2 — not MVP |
| Share 등록 | `POST .../shares` — §12 pending |
| Status manual complete | Status PATCH routes — user-driven later |

---

## 7. API commit sequence (on Step 6 confirm)

Strict order — stop on first error; show user which step failed.

```
1. POST /api/v1/formulas
      Body: item_id, unit, quantity, content, note, trade_type, created_by
      Headers: Authorization + X-Company-Id

2. FOR each participant (sequence_order ASC):
      POST /api/v1/formulas/{formula_id}/participants
      Body: company_id, sequence_order, role_group, buy_unit_price,
             sell_unit_price, is_start_point, is_end_point, ...
      (omit quantity → inherits formula quantity)

3. FOR each payment schedule (if any):
      POST /api/v1/formulas/{formula_id}/payment-schedules
      Body: participant_id, direction, scheduled_amount, scheduled_date, ...

4. IF logistics captured:
      POST /api/v1/formulas/{formula_id}/logistics
      Body: carrier_company_id, total_logistics_cost, cost_bearer_company_id,
             cost_type, ...

5. OPTIONAL read-back (UX only):
      GET /api/v1/formulas/{formula_id}
      GET /api/v1/formulas/{formula_id}/kpi/expected
      → Navigate to /app/formulas/{id}
```

| Rule | Detail |
|------|--------|
| **No batch API** | One HTTP request per row — Wizard orchestrates |
| **No transaction across routes** | Partial Formula possible on failure — UI must warn and offer cleanup or continue in Formula detail |
| **RBAC** | `POST /formulas` + participants require MANAGER+; schedules/logistics per existing matrix |
| **Company scope** | All calls use same `X-Company-Id` as active company |

---

## 8. UI state model (implementer reference)

```typescript
// In-memory session state until Step 6 confirm — NOT persisted Draft (§2.6)
interface FormulaWizardDraft {
  step1: { itemId; unit; quantity; content?; note? };
  step2: ParticipantDraft[];  // companyId, roleGroup, sequenceOrder, flags
  step3: Record<participantKey, { buyUnitPrice; sellUnitPrice }>;
  step4: PaymentScheduleDraft[];  // optional; skippedSteps includes 4 if empty + skip
  step5: LogisticsDraft | null;  // optional; skippedSteps includes 5 if skip
  reviewEditMode?: boolean;  // true after Step 6 [수정]; return via [검토로 돌아가기] (§15.3.6)
  skippedSteps?: (4 | 5)[];  // for Step Navigation (Skip) display (§15.2)
}
```

---

## 9. Validation gates

| Gate | Check |
|------|-------|
| Step 1 → 2 | item, quantity, unit present |
| Step 2 → 3 | ≥1 participant; active `companyId` included |
| Step 3 → 4 | All participants have prices (or explicit zero policy) |
| Step 5 | If cost > 0 → cost_bearer required |
| Step 6 | Full preview rendered; user explicit confirm |
| Commit | MANAGER+ role; company context present |

---

## 10. Forbidden (Wizard design)

| Forbidden | Reason |
|-----------|--------|
| New REST endpoints | Use Core MVP routes only |
| New DB columns / tables | SQL-first schema unchanged |
| Wizard-specific backend entity (`DraftFormula`, persisted draft API/DB) | **Deferred** (§2.6) — forbidden in **V1** |
| Duplicate Formula create API | Single `POST /formulas` |
| Manual `formula_no` / `version_no` | DB / Service responsibility |
| Payment records in Wizard | Actual cash is post-create |
| Invoice / Close / Cancel in Wizard | §6 |
| Dashboard / Timeline / Settlement Center expansion | Separate specs |
| Frontend-only company filter | DL-050 |

---

## 11. Relationship to other specs

| Spec | Relationship |
|------|--------------|
| `DASHBOARD_V1_SPEC.md` | Quick Action "Formula 생성"; §4 KPI policy **confirmed** v1.5.4 |
| `GLOBAL_COMPANY_CONTEXT_POLICY.md` | Active company = participant rule |
| `FEATURE_DECISION_AUDIT.md` | Wizard was **ungoverned** — this spec addresses gap; §12 still needs sign-off |
| `TOCS_API_SPEC_v1.1.md` | Authoritative API shapes for commit sequence |

---

## 12. Pending Decisions (pre-implementation)

**Purpose:** Product-owner decision list **before** Formula Wizard UI implementation.  
**Governance:** Items **A–C** remain **`Pending`**. Item **D (Draft)** is **`Deferred`** — see **§2.6 (confirmed)**.  
**Status legend:** **`Pending`** until sign-off; **`Deferred`** = excluded from V1, revisitable V2+.

| ID | Topic | Final decision status |
|----|-------|------------------------|
| **A** | Share Wizard 포함 여부 | **Pending** |
| **B** | Invoice 예정 정보 포함 여부 | **Pending** |
| **C** | Wizard에서 **Realized Net Profit** 표시 여부 | **Pending** |
| **D** | Draft 저장 (Wizard persist / resume) | **Deferred** (§2.6) |

**Note:** §12 **V1 추천안** on **A–C** are **discussion drafts only** — not approved defaults. **D** is decided for V1.

---

### A. Share Wizard 포함 여부

**Question:** Wizard 저장 전에 `formula_shares` 입력(정액/정률)까지 포함할 것인가?

| Field | Content |
|-------|---------|
| **옵션** | **A1 — 포함 (전용 Step)** — Step 5b 등에서 Share 금액/비율 입력 후 commit 시 `POST .../shares` 호출<br>**A2 — 포함 (선택)** — Share Step 존재하나 Skip 가능; 미입력 시 Formula detail에서 후속 등록<br>**A3 — 제외** — Wizard는 Share 미수집; Formula 생성 후 Share 모듈에서만 등록 |
| **장점** | **A1/A2:** 한 번의 Wizard 흐름으로 참여자·금액·Share까지 완결; 초기 snapshot에 Share 반영 가능<br>**A3:** Wizard 단계·검증 단순; Version/Snapshot 트리거 시점을 생성 직후가 아닌 Share 모듈로 분리 |
| **단점** | **A1/A2:** UI·검증 복잡도 증가; Share 변경은 항상 Version 생성(§5); participant/target 매핑 오입력 위험; commit sequence·실패 복구 부담<br>**A3:** Formula 생성 직후 Share 미입력 상태로 detail 이동 필요; “한 번에 끝내기” UX 기대와 불일치 가능 |
| **V1 추천안 (미승인)** | **A3 — 제외** — Core Wizard는 Formula + Participant + Schedule + Logistics까지; Share는 기존 Share API/UI 경로 유지 |
| **구현 영향도** | **A1:** High — 추가 Step, Share 폼, commit 순서 확장, Version 다건 발생 UX<br>**A2:** Medium–High — optional Step + 조건부 commit<br>**A3:** Low — §7 commit sequence 변경 없음 |
| **최종 결정 상태** | **Pending** |

**Existing API (no change):** `POST /api/v1/formulas/{formula_id}/shares` — Version-triggering (§5, `TOCS_API_SPEC_v1.1` §6).

---

### B. Invoice 예정 정보 포함 여부

**Question:** Wizard에서 계산서 **예정** 정보(발행 예정일, 예상 금액, counterparty 등)를 수집할 것인가?

| Field | Content |
|-------|---------|
| **옵션** | **B1 — 포함 (전용 Step)** — Step 4b 등에서 invoice 예정 입력 후 commit 시 `POST .../invoices` 호출<br>**B2 — 포함 (요약만)** — Step 6 검토에 “Invoice는 생성 후 등록” 안내만; 필드 수집 없음<br>**B3 — 제외** — Invoice 모듈에서만 등록; Wizard는 invoice 필드 없음 |
| **장점** | **B1:** 생성 직후 invoice_status 파생값과 업무 흐름을 한 화면에서 시작 가능<br>**B2:** 사용자 기대 관리(Invoice는 blocker 아님) 명확<br>**B3:** Wizard 범위 최소; Invoice 정책(§6)과 경계 유지 |
| **단점** | **B1:** participant/금액과 invoice line 매핑 중복 입력 위험; VAT/발행 주체 정책 미정(`DASHBOARD_V1_SPEC` §4.4 연계)<br>**B2:** 실질 입력 없음 — B3와 UX 차이 미미<br>**B3:** 생성 후 Invoice 화면 이동 필요 |
| **V1 추천안 (미승인)** | **B3 — 제외** — Invoice는 closure 조건이지 생성 blocker가 아님(§6); post-create Invoice 모듈 사용 |
| **구현 영향도** | **B1:** Medium–High — 추가 Step, invoice create 연동, 금액·participant 정합 검증<br>**B2:** Low — copy/UX only<br>**B3:** Low — §7 sequence unchanged |
| **최종 결정 상태** | **Pending** |

**Existing API (no change):** `POST /api/v1/formulas/{formula_id}/invoices` — Wizard §6 out-of-scope unless **B1** approved.

---

### C. Wizard에서 Realized Net Profit 표시 여부

**Question:** Wizard(Step 6 또는 post-commit read-back)에서 **Realized Net Profit (실현 순이익)** 을 표시할 것인가?

**Confirmed (§2.5):** Wizard preview metric = **Estimated Net Profit** only. **Realized Net Profit ≠ Estimated Net Profit** — 혼용 금지.

| Field | Content |
|-------|---------|
| **옵션** | **C1 — Wizard에 Realized 표시** — Step 6 또는 post-commit `GET .../kpi/confirmed` 노출<br>**C2 — post-commit read-back만 Realized** — commit 성공 후 confirmed KPI; Step 3/6 preview는 Estimated만<br>**C3 — Wizard 전 구간 Realized 미표시** — Estimated preview만(§2.4); Realized는 Formula detail·Dashboard(§4.4) |
| **장점** | **C1/C2:** 생성 직후 cash-basis 숫자 노출 시도<br>**C3:** §2.5 mixing rule 준수; Payment record 없을 때 Realized 0/무의미 **오해 방지** |
| **단점** | **C1/C2:** record 미등록 시 Realized **무의미**; Estimated와 **라벨 혼동** 위험<br>**C3:** Wizard에서 Realized 숫자 **미제공** |
| **V1 추천안 (미승인)** | **C3** — Wizard = **Estimated Net Profit**; **Realized Net Profit** = Payment 이후 · Dashboard P0 (§4.4 **confirmed**) |
| **구현 영향도** | **C1:** Medium — mixing-rule UX guardrails 필수<br>**C2:** Low–Medium — post-commit GET<br>**C3:** Low — §2.4·§2.5 유지 |
| **최종 결정 상태** | **Pending** |

**Related:** Dashboard P0 KPI + loss — `DASHBOARD_V1_SPEC.md` §4.4–§4.5 (**confirmed**).

---

### D. Draft — **Deferred (see §2.6)**

**Decision:** **Deferred from V1.** Wizard **does not** implement Draft save, Auto Save, Resume Flow, Draft list, or Draft expiry.

| Field | Content |
|-------|---------|
| **V1 scope** | **Excluded** — in-memory session until Step 6 Confirm; leave = discard |
| **V2+** | Client persist, server Draft, or staged commit — **separate policy**; requires DL · API · schema approval if backend involved |
| **Historical options (archived for V2 discussion)** | **D1** client storage · **D2** server Draft · **D3** in-memory only — **V1 follows D3 behavior without Draft product feature** |
| **최종 결정 상태** | **Deferred** (§2.6) |

---

### §12 decision workflow (when ready)

1. Product owner selects option per **A–C** and §14 **#5** (meeting or written sign-off).  
2. Update status to `Accepted` + option ID only after approval.  
3. **D (Draft):** **Deferred** — no V1 action; V2+ requires new spec slice (§2.6).  
4. Propose **DL-052** for remaining items if cross-cutting — optional.  
5. Wizard UI implements **§2.6** Draft exclusion plus approved **A–C** / **#5** rows only.

**DL-050 / DL-051** unchanged. **DL-052** not created until §12 decisions are approved.

---

## 13. Formula Creation User Journey Audit

**Purpose:** Verify whether Wizard Steps (§4) align with **real user work flow** — not API commit order (§7).  
**Governance:** This section **does not lock step order**. Order change remains **possible** until product/UI sign-off.  
**No decision values** — observations and open questions only.

### 13.0 Audit scope & order flexibility

| Topic | Audit note |
|-------|------------|
| **Current draft order (§3)** | 1 기본 → 2 참여 → 3 금액 → 4 입출금 예정 → 5 물류 → 6 검토 |
| **Order status** | **Not finalized** — reorder, merge, or skip-in-place may be applied after field validation |
| **Known reorder candidates** | **2↔3** (거래처·단가 동시 협상) · **4↔5** (물류비 확정 후 결제 조건) · **2+3 merge** (참여자·단가 한 화면) · **5 before 4** (운임 확정 후 입출금 예정) |
| **Fixed constraint** | Step 6 **검토** remains terminal before backend commit (§3) — position of review not debated here |
| **Commit order (§7)** | Independent of Wizard step order — API sequence unchanged regardless of UI step shuffle |

---

### Step 1 — 기본 정보

| # | Audit field | Content |
|---|-------------|---------|
| **1** | **사용자가 이 단계에서 알고 있는 정보** | 거래하려는 **품목**; 대략 **수량**; 관행상 **단위**(kg, ton, EA 등); 거래 메모·내부용 **내용/비고**; (간접) Global Company Context의 **자사 회사** — 품목·수량은 협상 전후 모두 확보되는 경우가 많음 |
| **2** | **이 단계에서 결정해야 하는 정보** | `item_id`, `unit`, `quantity`, `content`/`note` (선택); `trade_type` (Wizard v1 draft: DOMESTIC 가정 — **미확정**) |
| **3** | **이 단계에서 필요한 API 데이터** | **Read (Wizard open):** `GET /api/v1/items` (또는 item lookup) — 품목 선택·단위 힌트<br>**Write (commit only):** `POST /api/v1/formulas` body fields (§4 Step 1) |
| **4** | **다음 Step으로 넘어가기 위한 최소 조건** | `item_id`, `unit`, `quantity` present; `quantity > 0`; item 유효(마스터 존재) |
| **5** | **앞뒤 이동 가능 여부** | **뒤로:** Wizard 진입 취소(목록/Dashboard 복귀)만 — prior step 없음<br>**앞으로:** Step 2 이동 가능(§9 gate)<br>**순서 변경 시:** 일부 업무는 “거래처부터” 시작 → Step 1을 **2번째**로 내릴 가능성 **열림** (§13.0) |
| **6** | **자동 계산/자동 입력 가능 항목** | Item master에서 **unit** 제안; item description → `content` 초안; `formula_no` **표시만** (commit 후)<br>`trade_type` / `base_currency` — product default **후보** (확정 아님) |
| **7** | **실제 업무 기준 순서 적절성** | **적합한 경우:** “무엇을 얼마나 거래하는가”가 먼저인 조직<br>**부적합 가능:** counterparty·단가가 품목보다 먼저 정해지는 협상 — Step 1 선행이 **가정**일 뿐 **필수 업무 순서 아님** |

**Open question:** `trade_type` / 해외·환율 필드 노출 시점 — Step 1 vs 별도 Step (**Pending**, 본 audit에서 순서 미확정).

---

### Step 2 — 참여 회사

| # | Audit field | Content |
|---|-------------|---------|
| **1** | **사용자가 이 단계에서 알고 있는 정보** | **매입처·매출처** (협력사); **자사**가 매입/매출/중개 중 **어느 역할**인지; (선택) **운송사**; A→B→C **체인 순서**; start/end point 개념(출하·인수 주체) |
| **2** | **이 단계에서 결정해야 하는 정보** | Per row: `company_id`, `role_group`, `sequence_order`, `is_start_point` / `is_end_point`; nature/payment group (**선택·미확정 UI depth**); **active `companyId` ≥1 row 포함** (§2.2) |
| **3** | **이 단계에서 필요한 API 데이터** | **Read:** `GET /api/v1/companies` (search/list); Header **`X-Company-Id`** (context)<br>**Write (commit):** `POST .../participants` — Step 3 단가는 commit 시 merge (§4) |
| **4** | **다음 Step으로 넘어가기 위한 최소 조건** | ≥1 participant; active company `companyId` on ≥1 row; `sequence_order` unique > 0; start/end 각 ≤1 |
| **5** | **앞뒤 이동 가능 여부** | **뒤로 → Step 1:** **가능해야 함** (품목·수량 수정)<br>**앞으로 → Step 3:** **가능해야 함**<br>**순서 변경 시:** Step 3(금액)과 **병합**하거나 Step 3 **선행** 검토 가능 — participant 없이 단가 입력 불가하므로 **2는 3의 선행 dependency** (merge 시 예외) |
| **6** | **자동 계산/자동 입력 가능 항목** | Active company row **prefill 후보** (role 미확정 — 사용자 선택 필요); `sequence_order` auto 1..N; Step 5 `carrier_company_id`와 **동일 company sync 후보** (§12·순서 미확정) |
| **7** | **실제 업무 기준 순서 적절성** | **적합:** 거래 상대·체인 확정 후 단가/결제 논의<br>**부적합 가능:** 단가·조건이 먼저 oral agree → participant 나중; **품목(Step 1) 없이** counterparty만 아는 상태는 드묾 |

**Dependency note:** Step 2 rows are **keys** for Step 3 prices and Step 4 `participant_id` (client temp id until commit).

---

### Step 3 — 금액

| # | Audit field | Content |
|---|-------------|---------|
| **1** | **사용자가 이 단계에서 알고 있는 정보** | 협상된 **매입·매출 단가**; **VAT 포함/별도** 관행; (간접) Step 1 **수량**; (간접) Step 5 **물류비·cost_type** — 미입력 시 logistics preview 없음 |
| **2** | **이 단계에서 결정해야 하는 정보** | Per participant: `buy_unit_price`, `sell_unit_price`; VAT 표시 기준(**UI label only**); zero price 허용 여부 (**Pending** — §9 “explicit zero policy”) |
| **3** | **이 단계에서 필요한 API 데이터** | **Read (Wizard):** Step 1 `quantity`; Step 2 participant list<br>**Write (commit):** merged into `POST .../participants` (§7 #2) — **not** separate PATCH in Wizard |
| **4** | **다음 Step으로 넘어가기 위한 최소 조건** | All Step 2 rows have price decision (or documented skip/zero rule **Pending**); invalid negative prices rejected |
| **5** | **앞뒤 이동 가능 여부** | **뒤로 → Step 2:** **가능해야 함** (participant 변경 시 Step 3 invalidate/warn)<br>**앞으로 → Step 4:** **가능해야 함**<br>**순서 변경 시:** Step 2 **직후가 아닌 Step 5 이후**로 이동하면 logistics 반영 preview 지연 — **4↔5 reorder**와 충돌 가능 (§13.0) |
| **6** | **자동 계산/자동 입력 가능 항목** | `total_buy_amount` / `total_sell_amount` = `quantity × unit_price` (**GENERATED**, display); **Estimated Net Profit** preview (§2.5); Step 5 logistics in preview when entered |
| **7** | **실제 업무 기준 순서 적절성** | **적합:** counterparty 확정 직후 단가 입력<br>**부적합 가능:** 물류비가 단가에 **포함**(`INCLUDED_IN_*`)인 경우 Step 5 **선행** 정보 필요 — **3 before 5**가 draft order이나 업무상 **5→3** 정보 의존 **가능** |

**Cross-step tension:** **Estimated Net Profit** preview accuracy depends on Step 5 — partial preview until logistics entered (§2.5; **not** Realized Net Profit).

---

### Step 4 — 입출금 예정

| # | Audit field | Content |
|---|-------------|---------|
| **1** | **사용자가 이 단계에서 알고 있는 정보** | **결제 조건** (선입금·잔금·외상); **입금·출금 예정일**; **분할** 횟수·금액; 상대 **회사** (Step 2와 연결); **실제 입출금 발생 여부**는 아직 없음 |
| **2** | **이 단계에서 결정해야 하는 정보** | Per schedule: `direction`, `scheduled_amount`, `scheduled_date`, `payment_type`, `participant_id` / `counterparty_company_id`; split rows count |
| **3** | **이 단계에서 필요한 API 데이터** | **Read (Wizard):** Step 2 participants (temp ids); Step 3 totals (**hint only**, not API)<br>**Write (commit):** `POST .../payment-schedules` (§7 #3) — requires committed `formula_id` + `participant_id` |
| **4** | **다음 Step으로 넘어가기 위한 최소 조건** | **Optional step** — zero schedules allowed (§4); if any row: `scheduled_amount > 0`, direction set, participant/counterparty resolvable |
| **5** | **앞뒤 이동 가능 여부** | **뒤로 → Step 3:** **가능해야 함**<br>**앞으로 → Step 5 or 6:** Skip schedules → **가능해야 함**<br>**순서 변경 시:** **Step 5(물류)와 swap** 가능성 — 운임·부담 주체 확정 후 결제 조건 잡는 업무 (§13.0) |
| **6** | **자동 계산/자동 입력 가능 항목** | Step 3 total sell → IN schedule **suggestion 후보** (user must confirm — auto-fill **미확정**); Step 3 total buy → OUT schedule suggestion 후보; `payment_type` default from participant `payment_group` (**Pending** UI depth) |
| **7** | **실제 업무 기준 순서 적절성** | **적합:** 단가·총액 합의 후 **지급·수금 계획**<br>**부적합 가능:** 물류·통관비 **별도 지급** 일정이 먼저; import flow에서 **Step 5 선행** 논의 가능 |

**Scope boundary:** `payment-records` (실제 입출금) **not** in Wizard (§6).

---

### Step 5 — 물류

| # | Audit field | Content |
|---|-------------|---------|
| **1** | **사용자가 이 단계에서 알고 있는 정보** | **운송사**; **운송비**; **비용 부담 주체**; 출발·도착지; 운임이 **매입/매출가 포함** vs **별도**인지; (Step 2 carrier와 **동일 actor**인 경우 많음) |
| **2** | **이 단계에서 결정해야 하는 정보** | `carrier_company_id`, `total_logistics_cost`, `cost_bearer_company_id`, `cost_type`; optional locations / `transport_quantity` |
| **3** | **이 단계에서 필요한 API 데이터** | **Read:** `GET /api/v1/companies`; Step 2 carrier row (if any)<br>**Write (commit):** `POST .../logistics` (§7 #4) |
| **4** | **다음 Step으로 넘어가기 위한 최소 조건** | **Optional step** — skip entire logistics allowed; if `total_logistics_cost > 0` → `cost_bearer_company_id` required (API CHECK) |
| **5** | **앞뒤 이동 가능 여부** | **뒤로 → Step 4 (or 3):** **가능해야 함**<br>**앞으로 → Step 6:** **가능해야 함** (skip OK)<br>**순서 변경 시:** **Step 3 이전/병행** 후보 — `INCLUDED_IN_BUY/SELL`이면 단가 입력에 영향 (§13.0) |
| **6** | **자동 계산/자동 입력 가능 항목** | Step 2 운송사 participant → `carrier_company_id` **prefill 후보**; `transport_quantity` ← Step 1 `quantity` **후보**; expected profit impact label by `cost_type` (§4 Step 5 table) |
| **7** | **실제 업무 기준 순서 적절성** | **적합:** domestic 단순 거래에서 **단가·결제 후** 운송 확정<br>**부적합 가능:** import / FOB·CIF — **물류·운임이 단가 협상 전제**; draft order **5 after 3**는 이 패턴과 **긴장** (reorder **가능성**만 기록) |

**Cross-step tension:** Step 2 optional “운송사” vs Step 5 `carrier_company_id` — duplicate entry risk (§2.3); sync rule **Pending**.

---

### Step 6 — 검토

| # | Audit field | Content |
|---|-------------|---------|
| **1** | **사용자가 이 단계에서 알고 있는 정보** | Steps 1–5 **전체 입력**; (아직) **formula_no**·server KPI 없음; 실제 cash·invoice·share **미등록** |
| **2** | **이 단계에서 결정해야 하는 정보** | **Confirm vs Back vs Cancel** only — no new business fields; §12 **C** (**Realized Net Profit** in Wizard) **Pending** |
| **3** | **이 단계에서 필요한 API 데이터** | **Read (Wizard):** client-side aggregate only<br>**Optional read (post-confirm):** `GET .../formulas/{id}`, `GET .../kpi/expected` (§7 #5)<br>**Write:** full §7 sequence on Confirm |
| **4** | **다음 Step으로 넘어가기 위한 최소 조건** | Full §9 Step 6 gate; explicit user Confirm; MANAGER+; company context |
| **5** | **앞뒤 이동 가능 여부** | **뒤로 → Steps 1–5:** **가능해야 함** (edit loop)<br>**앞으로:** Confirm only — no Step 7 in Wizard<br>**순서 변경 시:** terminal review **위치는 유지** (commit 직전) |
| **6** | **자동 계산/자동 입력 가능 항목** | Merged tables; **Estimated Net Profit** preview (§2.5); VAT basis reminder; §12 Share/Invoice **Pending** |
| **7** | **실제 업무 기준 순서 적절성** | **적합:** 저장 전 **최종 확인**은 업무상 거의 universal<br>**Risk:** Step 3/5 순서 이슈로 review 시점 profit preview **불완전** — Back 유도 copy 필요 |

---

### 13.1 Cross-step dependency map (order-agnostic)

```
Step 1 (quantity, item, unit)
    ↓ used by
Step 3 (totals), Step 5 (transport_quantity hint), Step 6 summary

Step 2 (participants, sequence)
    ↓ used by
Step 3 (price rows), Step 4 (participant_id), Step 5 (carrier/bearer companies)

Step 3 (unit prices)
    ↓ used by
Step 4 (schedule amount hints), Step 6 profit preview

Step 5 (logistics, cost_type)
    ↓ used by
Step 3/6 profit preview (when SEPARATE vs INCLUDED)

Step 4 (schedules)
    ↓ independent of
Step 5 for API — but business negotiation may link them (order flexible)
```

**Implication:** Reordering Steps **1–5** is feasible in UI if **dependency map** satisfied at Step 6; §3 linear order is a **draft**, not approval.

---

### 13.2 Audit summary (non-binding)

| Observation | Status |
|-------------|--------|
| Step 6 review before commit matches common B2B practice | **Aligns** (terminal review — position not debated) |
| Step 1 before Step 2 | **Common** but not universal — reorder **possible** |
| Step 2 before Step 3 | **Strong dependency** unless merged UI |
| Step 3 before Step 5 | **Draft order**; **5 before 3** may fit import/inclusive-cost trades — **order not finalized** |
| Step 4 vs Step 5 | **Weak API dependency**; **business order** varies — swap **possible** |
| Step 2 carrier vs Step 5 logistics | **Duplicate-input risk** — needs UX rule (**Pending**) |
| §12 A–C · §14 #5 | May add/remove Steps — audit must **re-run** after closure |

**Next audit trigger:** §12 decision closure; first Wizard UI prototype; user interview with ≥1 trade operator.

---

### 13.3 Post-Create Navigation Audit

**Scope:** Where the app navigates **after successful Wizard commit** (§7 complete, no partial failure).  
**Governance:** Navigation policy **not finalized**. No default route is approved.  
**Final decision status:** **Pending**

**Context (existing draft, not policy):** §7 #5 optional read-back then `→ Navigate to /app/formulas/{id}` — maps to **후보 A** as **implementation sketch only**.

**Out of scope here:** Partial commit failure UX (§7); post-save module deep-links (Invoice, Share, Logistics edit); browser Back behavior.

---

#### 후보 A — 생성 완료 → Formula 상세

| Field | Content |
|-------|---------|
| **장점** | `formula_no`·6 status·KPI(`kpi/expected`) 확인; participant/child 탭으로 **후속 작업**(Payment record, Invoice, Share) 진입점 명확; 생성 결과 **검증**에 적합; Formula First ledger 중심 UX |
| **단점** | Step 4에서 schedule만 넣고 **실제 입출금** 바로 이어지려는 사용자에게 **추가 클릭**; Dashboard “한눈에” 흐름과 단절; 상세 화면 V1 미구현 시 **placeholder** 위험 |
| **업무 적합성** | “원장 생성 → 등록 내용 확인 → 세부 보완” 패턴과 **aligns**; audit/검수 중심 조직에 **자연스러움** |
| **모바일 적합성** | 상세 **탭·정보 밀도** 높으면 소화 부담; **확인 후 선택적 drill-down** 구조면 **수용 가능** (Product UI shell **Pending**) |
| **재작업 위험** | **Low–Medium** — 상세에서 바로 Payment/Invoice 이동 가능하면 **우회** 비용 작음; 상세 V1 scope가 **얇으면** Payment로 **재탐색** 발생 |
| **V1 적합성** | **High (conditional)** — Core read API·KPI **존재**; `NAVIGATION_ARCHITECTURE` Formula detail 경로와 **정합**; **조건:** Formula detail UI MVP 범위 확정 **Pending** |

---

#### 후보 B — 생성 완료 → Payment Schedule

| Field | Content |
|-------|---------|
| **장점** | Wizard Step 4 **직후** schedule·record 등록 **연속**; treasury/자금 담당 **다음 액션**과 **aligns**; 입출금 예정 **skip**한 경우에도 Payment hub에서 **보완** 가능 |
| **단점** | Formula **기본·참여·금액** 미확인 상태로 Payment 진입 → **오입력·participant mismatch** 위험; schedule **skip** 사용자에게 **문맥 불일치**; Payment Timeline UI **Not Started** (`PROJECT_CONTEXT` productization) |
| **업무 적합성** | 자금 일정이 **즉시** 이어지는 desk에 **aligns**; 품목·거래처 **확인**을 먼저 하는 desk와 **긴장** |
| **모바일 적합성** | Schedule/record 폼 **필드 많음** — 모바일 **입력 부담** 가능; **조회·확인** 위주면 Medium, **즉시 record**는 **부담** |
| **재작업 위험** | **Medium–High** — 잘못된 participant/amount 입력 시 **수정·취소** 루프; Formula 상세 **미경유** 시 **context loss** |
| **V1 적합성** | **Medium** — Payment **API shipped**; dedicated Payment UI **Not Started**; Wizard→Payment **딥링크** contract **미정의** |

---

#### 후보 C — 생성 완료 → Dashboard

| Field | Content |
|-------|---------|
| **장점** | `DASHBOARD_V1_SPEC` landing·KPI **맥락** 유지; 다건 등록 day에 **operations overview**; Quick Action “Formula 생성” **루프**와 **인지적 일관성** |
| **단점** | 방금 생성한 Formula **즉시 식별** 어려움 (Recent Activity **Pending** depth); **검증 gap** — 생성 성공·`formula_no` **확인 지연**; scope filter下 **목록 재탐색** 필요 |
| **업무 적합성** | **매니저 overview** workflow에 **aligns**; 단건 생성 **직후 검수** workflow와 **약한 align** |
| **모바일 적합성** | Summary cards·activity **list**는 모바일 **scan**에 **유리**; **deep detail** 부재 시 **추가 탭** 필요 |
| **재작업 위험** | **Medium** — Dashboard에서 Formula **재검색**; 잘못된 Formula **편집** 가능성은 **낮으나** **시간 손실** |
| **V1 적합성** | **Medium** — Dashboard spec **docs complete**; module UI **Not Started**; “생성 직후 KPI 반영” **지연** 가능 (list refresh) |

---

#### 후보 D — 생성 완료 → 새 Formula 생성

| Field | Content |
|-------|---------|
| **장점** | **Batch entry** (동일 품목·유사 거래 다건) **속도**; data entry **전용** 역할에 **aligns**; Wizard state **clean reset** |
| **단점** | 방금 Formula **미검증**; `formula_no` **기억 부담**; Step 4 schedule·오류 **미처리** 누적; **duplicate/over-create** 인지 부담 |
| **업무 적합성** | 월말 **대량 등록**·migration-style 입력에 **aligns**; **건-by-건 검수** culture와 **충돌** |
| **모바일 적합성** | Wizard **재진입**은 **가능**; 긴 multi-step **반복**은 모바일 **fatigue** |
| **재작업 위험** | **High** — 검수 **skip** 누적; partial data **다건**; 나중 Formula list에서 **찾아 수정** |
| **V1 적합성** | **Low–Medium** — 구현 **단순**(wizard restart); **운영 리스크** 대비 V1 **primary path**로 쓰기 **어려움** (정책 **미확정**) |

---

#### 13.3 Comparison matrix (non-binding)

| Candidate | Destination (draft path) | Final decision status |
|-----------|--------------------------|------------------------|
| **A** | `/app/formulas/{formula_id}` (Formula detail) | **Pending** |
| **B** | Payment schedule / Payment module for `{formula_id}` | **Pending** |
| **C** | `/app/dashboard` (or app landing per `NAVIGATION_ARCHITECTURE`) | **Pending** |
| **D** | `/app/formulas/new` (Wizard restart) | **Pending** |

**Combinations (not decided):** Primary redirect + toast action links (e.g. A + shortcut to Payment); user preference memory — **all Pending**.

**Re-audit when:** Formula detail UI scope fixed; Payment/Dashboard module UI started; first usability test.

---

## 14. Formula Wizard V1 Decision Table

**Purpose:** Single **representative approval sheet** for product owner sign-off before Wizard UI implementation.  
**Sources:** §12 (items 1–3), §2.6 (item 4), §13.3 (item 5).  
**Governance:** Items **1–3** and **5** remain **`Pending`**. Item **4 (Draft)** is **`Deferred`** per **§2.6**. **V1 판단안** on pending rows is **discussion only**.

| # | Topic | §Ref | 최종 승인 상태 |
|---|-------|------|----------------|
| **1** | Share 입력 포함 여부 | §12 A | **Pending** |
| **2** | Invoice 예정 정보 포함 여부 | §12 B | **Pending** |
| **3** | Wizard에서 **Realized Net Profit** 표시 여부 | §12 C | **Pending** |
| **4** | Draft 저장 / Auto Save / Resume | §2.6 | **Deferred** |
| **5** | 생성 완료 후 이동 위치 | §13.3 | **Pending** |

---

### 1. Share 입력 포함 여부

| Field | Content |
|-------|---------|
| **옵션** | **A1** — Wizard에 Share 전용 Step 포함, commit 시 `POST .../shares`<br>**A2** — Share Step 선택(Skip 가능), 미입력 시 Formula detail 후속<br>**A3** — Wizard에서 Share 미수집, Share 모듈만 |
| **실무 영향** | **A1/A2:** 생성 직후 snapshot에 Share 반영·정산 규칙 조기 입력<br>**A3:** 생성 후 Share 담당이 별도 화면에서 등록·Version 발생 시점 분리 |
| **구현 영향** | **A1:** High — Step·commit·Version UX<br>**A2:** Medium–High — optional path<br>**A3:** Low — §7 unchanged |
| **V1 판단안 (논의용)** | **A3** — Core Wizard 범위를 Formula·Participant·Schedule·Logistics로 유지 |
| **최종 승인 상태** | **Pending** |

---

### 2. Invoice 예정 정보 포함 여부

| Field | Content |
|-------|---------|
| **옵션** | **B1** — Invoice 예정 Step, commit 시 `POST .../invoices`<br>**B2** — Step 6에 Invoice 안내 copy만<br>**B3** — Wizard에서 Invoice 필드 없음, Invoice 모듈만 |
| **실무 영향** | **B1:** 발행 예정·counterparty를 생성 직후부터 추적<br>**B2/B3:** Invoice는 close 조건이지 생성 blocker(§6) — 생성 후 등록 |
| **구현 영향** | **B1:** Medium–High — Step·invoice line 정합<br>**B2:** Low — copy<br>**B3:** Low — §7 unchanged |
| **V1 판단안 (논의용)** | **B3** — Invoice post-create 모듈 |
| **최종 승인 상태** | **Pending** |

---

### 3. Wizard에서 Realized Net Profit 표시 여부

| Field | Content |
|-------|---------|
| **옵션** | **C1** — Wizard Step 6 / post-commit에 Realized (`kpi/confirmed`)<br>**C2** — post-commit read-back Realized only; preview = Estimated only<br>**C3** — Wizard 전 구간 Realized 미표시; **Estimated Net Profit** preview only (§2.5) |
| **실무 영향** | **C1/C2:** Payment record 없으면 Realized **0/무의미** — Estimated와 **혼동** 위험 (§2.5 mixing rule)<br>**C3:** Wizard = Expected path; Realized = Payment·Dashboard |
| **구현 영향** | **C1:** Medium · **C2:** Low–Medium · **C3:** Low |
| **V1 판단안 (논의용)** | **C3** — Wizard **Estimated Net Profit**; Realized on Dashboard P0 (§4.4 confirmed) |
| **최종 승인 상태** | **Pending** |

---

### 4. Draft — **Deferred (V1 excluded)**

| Field | Content |
|-------|---------|
| **Policy (§2.6)** | **Deferred** — not V1 scope |
| **V1** | No Draft save · No Auto Save · No Resume Flow · No Draft list · No Draft expiry |
| **Runtime** | In-memory until Step 6 Confirm; discard on leave |
| **Reason** | Formula lifecycle complexity; Productization V1 scope minimization |
| **V2+** | Revisit under separate policy — **Deferred ≠ permanent ban** |
| **최종 승인 상태** | **Deferred** |

---

### 5. 생성 완료 후 이동 위치

| Field | Content |
|-------|---------|
| **옵션** | **A** — Formula 상세 `/app/formulas/{formula_id}`<br>**B** — Payment Schedule / Payment module (`{formula_id}`)<br>**C** — Dashboard `/app/dashboard`<br>**D** — 새 Formula 생성 `/app/formulas/new` |
| **실무 영향** | **A:** 생성 결과 검증·후속 탭(Invoice, Share, Payment)<br>**B:** 자금 일정·record 연속 입력<br>**C:** overview·다건 등록 day<br>**D:** batch entry, 검수 skip·중복 생성 인지 부담 |
| **구현 영향** | **A:** Formula detail UI scope 의존 (§13.3)<br>**B:** Payment UI·딥링크 contract 미정<br>**C:** Dashboard UI·Recent Activity depth<br>**D:** Wizard restart only — 낮은 UI, 높은 운영 리스크 |
| **V1 판단안 (논의용)** | **A** — §7 sketch와 정합; **조건:** Formula detail V1 scope |
| **최종 승인 상태** | **Pending** |

---

### §14 Approval workflow (when ready)

| Step | Action |
|------|--------|
| 1 | Representative reviews this table + §12 / §13.3 detail |
| 2 | Per row: record **approved option ID** and **최종 승인 상태 → Accepted** — **only after written sign-off** |
| 3 | Update §12 / §13.3 cross-references; propose **DL-052** if needed — **not in this batch** |
| 4 | Unapproved **Pending** rows block related UI; **Deferred** row (#4) is fixed for V1 per §2.6 |

**Batch status:** **#1–3, #5 Pending** · **#4 Deferred (§2.6)** — no option IDs required for Draft.

---

## 15. Screen wireframe (Productization V1)

**Scope:** Information architecture and **ASCII wireframe only**. **No** visual design system, **no** React/components, **no** v0 code.

**Route (design):** `/app/formulas/new` — see [`NAVIGATION_ARCHITECTURE.md`](./NAVIGATION_ARCHITECTURE.md).

### 15.0 Wireframe principles

| Principle | Wireframe rule |
|-----------|----------------|
| **최소 클릭** | One primary action per step (`다음` / `생성`); optional steps skippable (Step 4, 5) |
| **최소 인지부하** | One decision cluster per step; totals/previews **read-only** where DB GENERATED |
| **실시간 Preview** | Step 3+ show **Estimated Net Profit** preview; updates as inputs change — **not** Realized |
| **Formula First** | Wizard creates **one Formula**; all fields map to existing POST sequence (§7) |
| **Company Context** | Header shows active company; **must** appear in Step 2 participants (§2.2) |
| **Draft 없음** | **No** save/resume (§2.6); leave warning only — discard on confirm leave |
| **No actual cash** | Step 4 = **schedules only** — no `payment-records` (§6) |
| **No Close/Cancel/Settlement** | Not in Wizard (§6) |
| **Step Navigation vs jump** | Stepper = **progress display only** (§15.2); section **[수정]** on Step 6 = **edit jump** (§15.3.6) |

---

### 15.1 Wizard shell — Header (all steps)

```
┌────────────────────────────────────────────────────────────────────────┐
│ WIZARD HEADER                                                           │
│ [← 취소]   Formula 생성          [Company: ○○○ Ltd ▼ read-only/context] │
│            (저장 전 — 이탈 시 입력 내용이 사라짩니다)                      │
├────────────────────────────────────────────────────────────────────────┤
│ STEP NAVIGATION (desktop — header or top strip; see §15.2)              │
│ ① 기본정보 ✓  ② 참여회사 ✓  ③ 금액 ●  ④ 예정입출금  ⑤ 물류  ⑥ 검토      │
└────────────────────────────────────────────────────────────────────────┘
```

| Element | Behavior |
|---------|----------|
| **Company Context 표시** | Active company name from global switcher; Wizard **inherits** `X-Company-Id` — not editable inside Wizard |
| **Step Navigation** | Always visible — state rules in **§15.2** (display-only; not a jump control) |
| **저장 전 이탈 경고** | `취소` or browser back → confirm dialog — **no** Draft persist (§2.6) |
| **SUPER_ADMIN** | Wizard blocked until company selected — not `all` scope (§2.2) |

**Footer — linear flow (Steps 1–5, first visit):** `[ 이전 ]` `[ 다음 ]`

**Footer — Step 6:** `[ 이전 ]` `[ Formula 생성 ]`

**Footer — Review edit mode (§15.3.6):** on target step after `[수정]` — `[ 검토로 돌아가기 ]` primary; `[ 이전 ]` optional for local edits within that step cluster

---

### 15.2 Step Navigation

**Purpose:** User **instantly knows** current position in the 6-step Wizard. **Not** a substitute for Step 6 **[수정]** links — stepper items are **non-clickable** in V1 wireframe (progress indicator only).

#### State definitions

| State | Symbol | When |
|-------|--------|------|
| **완료** | `✓` | User passed validation and left the step (forward or via Review return) |
| **현재** | `●` | Active step |
| **미완료** | *(empty)* | Not yet reached, or reached but validation not passed |
| **건너뛴 (Skip)** | `Skip` or `(Skip)` | Optional Step **4** or **5** explicitly skipped — **allowed only** on optional steps |

**Skip rules:**

| Step | Skip allowed | Stepper when skipped |
|------|--------------|----------------------|
| 4 — 예정 입출금 | Yes | `④ 예정입출금 (Skip)` — not `✓` unless user entered data then cleared |
| 5 — 물류 | Yes | `⑤ 물류 (Skip)` |
| 1–3, 6 | No | Must show `✓` / `●` / empty only |

If user skips Step 4 then later opens Step 4 via **[수정]**, state becomes `●` until they **검토로 돌아가기** or complete the step.

#### Desktop wireframe (header or top strip)

```
① 기본정보 ✓   ② 참여회사 ✓   ③ 금액 ●   ④ 예정입출금   ⑤ 물류   ⑥ 검토
```

Example with optional steps skipped:

```
① 기본정보 ✓   ② 참여회사 ✓   ③ 금액 ✓   ④ 예정입출금 (Skip)   ⑤ 물류 (Skip)   ⑥ 검토 ●
```

| Rule | Detail |
|------|--------|
| **즉시 인지** | Step number + short label + state symbol always visible on desktop |
| **직접 이동** | Stepper **not** clickable — use Step 6 **[수정]** only (§15.3.6) |
| **Company Context** | Unchanged in header while stepper updates |

#### Mobile wireframe (compact header)

```
┌──────────────────┐
│ Step 3 / 6 — 금액 │
│ ████████░░░░ 50% │
└──────────────────┘
```

| Rule | Detail |
|------|--------|
| **현재 단계명** | `Step N / 6 — {label}` — label matches stepper (기본정보 · 참여회사 · 금액 · 예정입출금 · 물류 · 검토) |
| **Progress bar** | Same ratio as `N / 6` |
| **Full stepper** | Optional expand/collapse — if hidden, **step name + bar** are mandatory |
| **Skip on mobile** | Append `(Skip)` to step name when viewing a skipped optional step from Review edit |

---

### 15.3 Step wireframes (desktop)

#### Step 1 — 기본 정보

```
┌────────────────────────────────────────────────────────────────────────┐
│ Step 1 — 기본 정보                                                      │
├────────────────────────────────────────────────────────────────────────┤
│ 품목 *        [ Item search / select ▼                          ]       │
│ 단위 *        [ kg ▼ ]                                                  │
│ 수량 *        [ 1000                    ]                             │
│ 메모          [ optional textarea                              ]       │
└────────────────────────────────────────────────────────────────────────┘
```

| Field | API (commit) |
|-------|--------------|
| 품목 | `item_id` |
| 단위 | `unit` |
| 수량 | `quantity` |
| 메모 | `content` / `note` |

---

#### Step 2 — 참여 회사

```
┌────────────────────────────────────────────────────────────────────────┐
│ Step 2 — 참여 회사                                                      │
│ Active company ★ must appear below                                      │
├────────────────────────────────────────────────────────────────────────┤
│ ┌ seq │ 회사          │ 역할      │ start │ end │                      │
│ │  1  │ ★ My Co (ctx) │ [매출처▼] │ [ ]   │ [ ] │                      │
│ │  2  │ [ Supplier ▼] │ [매입처▼] │ [ ]   │ [ ] │                      │
│ │  3  │ [ Carrier  ▼] │ [운송  ▼] │ opt   │     │  ← 운송사 선택 가능   │
│ └─────┴───────────────┴───────────┴───────┴─────┘                      │
│ [ + 참여자 추가 ]                                                       │
└────────────────────────────────────────────────────────────────────────┘
```

| Rule | Detail |
|------|--------|
| **선택 회사 포함 필수** | Row with global `companyId` **required** |
| **매입처 / 매출처** | `role_group` slots |
| **운송사** | Optional row; may link to Step 5 carrier |
| **역할 표시** | Role label visible per row |

---

#### Step 3 — 금액

```
┌────────────────────────────────────────────────────────────────────────┐
│ Step 3 — 금액                                    [ VAT 기준: ○ 포함 ○ 별도 ] │
├────────────────────────────────────────────────────────────────────────┤
│ Participant      │ 매입단가 * │ 매출단가 * │ 총매입   │ 총매출   │        │
│ My Co (매출)     │ [    ]     │ [ 1500 ]   │ (auto)   │ (auto)   │        │
│ Supplier (매입)  │ [ 1000 ]   │ [    ]     │ (auto)   │ (auto)   │        │
├────────────────────────────────────────────────────────────────────────┤
│ PREVIEW (read-only, Estimated Net Profit)                               │
│ 합계 예상 순이익:  ₩ ……    │  회사별: My Co ₩… │ Supplier ₩… │ …      │
└────────────────────────────────────────────────────────────────────────┘
```

| Field | Rule |
|-------|------|
| 매입단가 / 매출단가 | Input per participant |
| 총매입 / 총매출 | **Read-only** — `quantity × unit_price` |
| **예상 순이익 Preview** | **Estimated Net Profit** aggregate (§2.5) — label mandatory |
| **회사별 예상 순이익 Preview** | Per-participant line preview — **Estimated only** |

---

#### Step 4 — 예정 입출금 (optional — skip allowed)

```
┌────────────────────────────────────────────────────────────────────────┐
│ Step 4 — 예정 입출금                          [ 건너뛰기 → Step 5 ]        │
├────────────────────────────────────────────────────────────────────────┤
│ [ + 입금 예정 ]  [ + 출금 예정 ]                                         │
│ ┌ type: ( )선입금 ( )잔금 ( )외상  │ direction │ amount │ date │ split │
│ │ … 분할 입력 — multiple rows allowed                                  │
│ └──────────────────────────────────────────────────────────────────────│
│ ⚠ 실제 입출금은 생성 후 Payment에서 등록 (§6)                            │
└────────────────────────────────────────────────────────────────────────┘
```

| Concept | Maps to |
|---------|---------|
| 입금 / 출금 예정 | `payment-schedules` IN / OUT |
| 선입금 / 잔금 / 외상 | `payment_type` |
| 분할 입력 | Multiple schedule rows |

---

#### Step 5 — 물류 (optional — skip allowed)

```
┌────────────────────────────────────────────────────────────────────────┐
│ Step 5 — 물류                                [ 건너뛰기 → Step 6 ]        │
├────────────────────────────────────────────────────────────────────────┤
│ 운송사 *        [ Carrier ▼ ]     (prefill from Step 2 if set)         │
│ 운송비          [ 300000        ]                                       │
│ 비용 부담 주체 * [ Company ▼   ]   (required if cost > 0)               │
│ cost_type       ( )별도 ( )매입포함 ( )매출포함                          │
└────────────────────────────────────────────────────────────────────────┘
```

Preview panel may update Step 3 **Estimated** profit when cost entered.

---

#### Step 6 — 검토

```
┌────────────────────────────────────────────────────────────────────────┐
│ Step 6 — 검토 (mandatory)                                               │
├────────────────────────────────────────────────────────────────────────┤
│ ▼ 기본 정보           item │ qty │ unit │ memo              [ 수정 ]   │
│ ▼ 참여 회사           table (Step 2 + roles)            [ 수정 ]       │
│ ▼ 금액                totals │ Estimated Net Profit       [ 수정 ]       │
│ ▼ 예정 입출금         schedule list or “없음” / (Skip)    [ 수정 ]       │
│ ▼ 물류                summary or “없음” / (Skip)          [ 수정 ]       │
│ ▼ Share (optional)    …                                 [ 수정/추가 ]  │
│ ▼ Invoice             …                                 [ 수정/추가 ]  │
├────────────────────────────────────────────────────────────────────────┤
│                              [ 이전 ]  [ Formula 생성 ]                 │
└────────────────────────────────────────────────────────────────────────┘
```

| Section | Source | Review link |
|---------|--------|-------------|
| 기본 정보 | Step 1 | `[ 수정 ]` → Step 1 |
| 참여 회사 | Step 2 | `[ 수정 ]` → Step 2 |
| 금액 | Step 3 | `[ 수정 ]` → Step 3 |
| 예정 입출금 | Step 4 | `[ 수정 ]` → Step 4 (empty / Skip shown) |
| 물류 | Step 5 | `[ 수정 ]` → Step 5 |
| Share (optional) | §12 **Pending** | `[ 수정/추가 ]` → in-Wizard slot **if approved**; else copy → Formula Detail **Shares** tab post-create |
| Invoice | §12 **Pending** | `[ 수정/추가 ]` → in-Wizard slot **if approved**; else copy → Formula Detail **Invoices** tab post-create |

**Confirm:** `[ Formula 생성 ]` only — triggers §7 commit sequence; **no** backend write before click.

##### 15.3.6 Review edit navigation (Review edit mode)

**Goal:** Fix a section without `[ 이전 ]` × N — **one click** from Step 6 to the target step, **one click** back to Review.

| Action | Behavior |
|--------|----------|
| Click `[ 수정 ]` on a section | Set **Review edit mode** = true; navigate to mapped step; stepper shows target as `●` |
| Edit fields | **Client in-memory state only** — same as first pass; **no** API, **no** Draft save |
| `[ 검토로 돌아가기 ]` | Return to Step 6; re-render all summary sections; stepper Step 6 = `●` |
| `[ 다음 ]` during Review edit | **Not shown** as primary — avoid walking Steps 4→5→6 after fixing Step 3 |
| `[ 이전 ]` during Review edit | Optional — within-step only; does **not** replace `[ 검토로 돌아가기 ]` |
| Re-enter Step 6 | User may click another `[ 수정 ]` or `[ Formula 생성 ]` |

**Forbidden in Review edit mode:** intermediate save, Draft create, `payment-records`, Close/Cancel/Settlement, any HTTP commit (§15.6).

---

### 15.4 완료 후 (post-create)

```
┌────────────────────────────────────────────────────────────────────────┐
│ ✓ Formula 생성 완료          formula_no: FM-YYMM-#####                   │
├────────────────────────────────────────────────────────────────────────┤
│ [ Formula Detail 로 이동 ]     ← primary (Overview tab)                 │
│ [ 세부사항 설정 ]              ← same Detail — child tabs / next actions  │
│                                                                 (optional)│
│ Secondary hints (copy only): Payment record · Invoice · Share — post Detail│
└────────────────────────────────────────────────────────────────────────┘
```

| Action | Target |
|--------|--------|
| **Formula Detail 이동** | `/app/formulas/{id}` — **Overview** (§13.3 후보 A — wireframe default) |
| **세부사항 설정** | Formula Detail — Participants / Payments / Invoices / etc. (`NAVIGATION_ARCHITECTURE` §4) |

**Forbidden on this screen:** Close, Cancel Formula, Settlement, payment **record** create.

---

### 15.5 Mobile wireframe

**Rule:** One step **full screen** at a time; header (§15.1 + §15.2 mobile) sticky; fields **vertical stack**; preview blocks below inputs.

```
┌──────────────────┐
│ Step 3 / 6 — 금액 │
│ ████████░░░░ 50% │
├──────────────────┤
│ (step fields)    │
│ stacked          │
├──────────────────┤
│ Preview (if any) │
├──────────────────┤
│ [이전]  [다음]   │  ← or [검토로 돌아가기] in Review edit mode
└──────────────────┘
```

**Step 6 mobile:** each summary block = collapsible card with `[ 수정 ]` on the **right** (same targets as §15.3.6).

Same step order, stepper states, and validation as desktop.

---

### 15.6 Wireframe forbidden

| Forbidden | Reason |
|-----------|--------|
| React / component specs | Out of scope |
| Visual design tokens | Design phase |
| Draft save / Auto-save UI | §2.6 Deferred |
| **Save on `[ 수정 ]` click** | Client state only until `[ Formula 생성 ]` |
| **API call during Review edit** | Commit only on Step 6 confirm (§7) |
| Clickable stepper jump (V1) | Progress display only — edits via Step 6 `[ 수정 ]` (§15.2) |
| `payment-records` in Wizard | §6 |
| Close / Cancel / Settlement controls | §6 |
| Realized Net Profit as Step 3 preview label | §2.5 — Estimated only |
| Backend write before Step 6 confirm | §3 |

---

## Document history

| Date | Change |
|------|--------|
| 2026-07-01 | v1.5.1 — Minimal Formula Wizard core design (docs only) |
| 2026-07-01 | v1.5.1 — §12 expanded: A–D decision matrix (all Pending; recommendations non-binding) |
| 2026-07-01 | v1.5.1 — §13 Formula Creation User Journey Audit (order not finalized) |
| 2026-07-01 | v1.5.1 — §13.3 Post-Create Navigation Audit (A–D, all Pending) |
| 2026-07-01 | v1.5.1 — §14 V1 Decision Table for representative approval (5 items, all Pending) |
| 2026-07-01 | v1.5.2 — §2.5 Estimated vs Realized Net Profit terminology (confirmed); §12/§14 C relabeled |
| 2026-07-01 | v1.5.3 — §2.6 Draft policy **Deferred** from V1; §12 D · §14 #4 updated |
| 2026-07-01 | v1.5.3 — Cross-ref Dashboard KPI v1.5.4 (Realized on Dashboard) |
| 2026-07-01 | v1.5.8 — **§15 Screen wireframe** (Header, Steps 1–6, post-create, mobile) |
| 2026-07-01 | v1.5.9 — **§15.2 Step Navigation** (✓ / ● / Skip); **§15.3.6 Review `[수정]`** + edit mode |
