# TOCS Formula Wizard — Core Design (Minimal Spec)

## Document status

| Field | Value |
|-------|--------|
| **Version** | v1.5.1 (Specification — documentation only) |
| **Status** | DRAFT — pending product approval for open items (§12) |
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

### 2.4 Calculation policy

- **Expected profit (계산상 이익)** preview in Wizard uses the **same business meaning** as `v_formula_profit_engine` / latest `formula_calculation_snapshots` — i.e. expected engine values, **not** confirmed bank cash.
- **Before save (Step 6):** show **client-side preview** only; label clearly as `저장 전 예상치`.
- **After save:** read **existing** `GET /api/v1/formulas/{id}/kpi/expected` — no new KPI API.
- **Confirmed / realized profit** is **out of scope** at create time unless §12 approval grants Step 6 display.

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
| Confirm | **Existing POST APIs** | Ordered commit sequence (§8) |

**Forbidden:** Partial backend create before Step 6 confirm (unless §12 Draft approval introduces staged save).

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
| 계산상 이익 (line or total) | Preview | Client calc: Σ sell − Σ buy − logistics preview (Step 5 if entered) |

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

| `cost_type` | Meaning for expected profit |
|-------------|----------------------------|
| `SEPARATE_COST` | Logistics cost reduces expected profit in engine (snapshot `expected_cost`) |
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
| 금액 | Totals, VAT basis note, **저장 전 예상치** profit |
| 예정 입출금 | Step 4 schedule list |
| 물류비 | Step 5 summary + cost_type explanation |
| 예상 이익 | Preview label; post-save link to Formula KPI |

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
// Client-only until Step 6 confirm — NOT a backend entity
interface FormulaWizardDraft {
  step1: { itemId; unit; quantity; content?; note? };
  step2: ParticipantDraft[];  // companyId, roleGroup, sequenceOrder, flags
  step3: Record<participantKey, { buyUnitPrice; sellUnitPrice }>;
  step4: PaymentScheduleDraft[];  // optional
  step5: LogisticsDraft | null;  // optional
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
| Wizard-specific backend entity (`DraftFormula`, etc.) | Unless §12 Draft approved — client only by default |
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
| `DASHBOARD_V1_SPEC.md` | Quick Action "Formula 생성" launches this Wizard |
| `GLOBAL_COMPANY_CONTEXT_POLICY.md` | Active company = participant rule |
| `FEATURE_DECISION_AUDIT.md` | Wizard was **ungoverned** — this spec addresses gap; §12 still needs sign-off |
| `TOCS_API_SPEC_v1.1.md` | Authoritative API shapes for commit sequence |

---

## 12. Pending approval (product owner)

**Do not implement** these until explicitly approved:

| # | Question | Default if deferred |
|---|----------|---------------------|
| A | **Share in Wizard?** Include Step 5b / share amounts before save? | **No** — add Share in Formula detail after create |
| B | **Invoice planned info in Wizard?** Collect expected invoice dates/amounts? | **No** — Invoice module post-create |
| C | **실현 순이익 at create?** Show confirmed profit on Step 6? | **No** — only 계산상 이익 preview + post-save KPI link |
| D | **Draft save in V1?** Persist wizard state across sessions? | **No** — client session only; abandon on leave |

**DL-051 / DL-050** are unchanged. A formal **DL-052** (Formula Wizard) may be proposed **after** §12 items are decided — not in this batch.

---

## Document history

| Date | Change |
|------|--------|
| 2026-07-01 | v1.5.1 — Minimal Formula Wizard core design (docs only) |
