TOCS v0 UI Development Specification







Field



Value





Version



v1.0.0





Status



Implementation instructions for v0 (UI developer)





Mode



UI/UX only — mock preview behavior, no API wiring





Audience



v0 (UI implementation agent)





Architect source



Backend vs v0 UI Comparison Audit (2026-07-07)





Baseline branch



tocs-frontend-design @ local working tree (Batch 1 + Batch 2 workflows)



0. Global Constraints for v0





Formula First — every screen derives from formula_id; never introduce Deal/Order/Project roots.



Mock preview only — all writes update in-memory preview (formula-preview-mutations.ts, formula-preview-session.ts). Show MockPreviewNote on every mutation surface.



Do not redesign — extend existing TOCS design language, components, and tab shell.



Do not invent business rules — if backend route is missing (G1–G10), keep disabled/stubbed UI with existing BACKEND_ROUTE_GAPS copy.



Do not wire HTTP — label future binding points only; never call fetch or repository API methods.



RBAC — hide (do not merely disable) controls the user cannot perform per RBAC_PERMISSION_MATRIX.md / permissions.ts.



Closed formula policy (DL-033) — when is_closed = TRUE, normal tabs are read-only for trade data; post-close writes only on Settlement tab (allowlist).

Existing components to extend (do not replace):





web/components/formulas/formula-detail-view.tsx



web/components/formulas/detail-panels.tsx



web/components/formulas/workflows/workflow-modals.tsx



web/components/formulas/workflows/batch-2-workflows.tsx



web/components/formulas/workflows/formula-workflow-context.tsx



web/lib/permissions.ts



web/lib/formula-preview-mutations.ts



Login

V0-AUTH-01 — Protected App Shell / Route Guard







Field



Value





Feature ID



V0-AUTH-01





Feature Name



Auth route guard





Why backend requires it



GET /api/v1/auth/me defines session principal; middleware enforces scope on all routes. UI must reflect authenticated identity before showing write affordances.





Backend source



src/http/routes/auth.routes.ts, src/actions/auth.actions.ts





Current UI



/login exists; AuthProvider bootstraps preview session; no guard — app routes load without login.





Required UI



Client guard: unauthenticated users redirect to /login; authenticated users skip login. /login renders without AppShell.





Interaction Flow



User opens any app route → if no preview session → redirect /login → sign in → redirect prior route or /formulas.





User Journey



Operations user signs in → sees scoped companies → proceeds to work.





Component hierarchy



ShellWrapper → check useAuth().user + loading → redirect or render children.





Modal(s)



None





Toolbar(s)



None





Buttons



None new





Fields



None





Validation



Block render until loading === false.





Status



Redirect in progress spinner on guarded routes.





Empty state



N/A





Loading state



Full-page minimal spinner while AuthProvider bootstraps.





Error state



N/A (login page handles invalid credentials).





Permission / RBAC



All roles must pass guard; role applied after login.





Formula impact



None





Version impact



None





Timeline impact



None





Settlement impact



None





Future API binding point



GET /api/v1/auth/me replaces previewMe().





Visual priority



P0





Implementation priority



P0

Acceptance Criteria





Visiting /formulas without session redirects to /login.



After login, user returns to app with header showing name + role.



/login has no sidebar/header chrome.

Instruction to v0

Create this workflow in ShellWrapper (or a thin AuthGuard wrapper). Use the existing TOCS design language. Do not redesign the layout. Extend AuthProvider + ShellWrapper only. Maintain Formula First architecture. Do not invent business rules. Represent backend session semantics visually. Use mock preview behavior only (auth-preview-session.ts). No API wiring.



V0-AUTH-02 — Header Auth Hydration Fix







Field



Value





Feature ID



V0-AUTH-02





Feature Name



Header SSR/hydration-safe auth display





Why backend requires it



Session is client-only; SSR must not render conflicting auth chrome.





Backend source



GET /api/v1/auth/me





Current UI



header.tsx shows Sign in on SSR then Demo Admin after hydrate — React hydration warning.





Required UI



Auth chip renders only after client mount OR use consistent placeholder that matches post-hydrate state.





Interaction Flow



Header mounts → loading skeleton for user area → user chip appears.





User Journey



No flicker or dev overlay errors.





Component hierarchy



Header → AuthUserChip (client-only).





Visual priority



P1





Implementation priority



P1

Acceptance Criteria





No React hydration mismatch on header.tsx in dev.



User name and role display unchanged after fix.

Instruction to v0

Fix hydration in header.tsx using a client-mount gate or skeleton for the auth region. Use existing TOCS design language. Extend header only. Mock preview only. No API wiring.



Dashboard

V0-DASH-01 — Attention / Unmatched Drill-down Labels







Field



Value





Feature ID



V0-DASH-01





Feature Name



KPI drill-down context preservation





Why backend requires it



Dashboard KPIs derive from v_formula_confirmed_kpi, v_payment_unmatched; drill-down must land on Formula-scoped views.





Backend source



src/http/routes/dashboard.routes.ts





Current UI



KPI cards link to /formulas with query params — mostly complete.





Required UI



Verify all dashboard links carry company, range, filter, metric query params consistently.





Visual priority



P2





Implementation priority



P2

Acceptance Criteria





Loss ranking, attention, and unmatched links open Formula List or Detail with context chips visible.

Instruction to v0

Audit existing dashboard links in web/app/page.tsx and web/components/dashboard/*. Fix any link missing scope/range params. Do not redesign cards. Mock preview only.



Formula List

V0-LIST-01 — Wizard-Created Formula Visibility







Field



Value





Feature ID



V0-LIST-01





Feature Name



Preview-created formulas in list





Why backend requires it



POST /api/v1/formulas creates a new row; list must show it immediately after wizard.





Backend source



GET /api/v1/formulas, POST /api/v1/formulas





Current UI



mergeFormulasForScope() in dirty tree — verify stable behavior.





Required UI



After wizard submit, new formula appears in list for owning companyId without refresh.





Interaction Flow



Wizard submit → navigate detail → back to list → row present.





Future API binding point



listFormulas repository method.





Visual priority



P0





Implementation priority



P0

Acceptance Criteria





Wizard-created formula visible on /formulas for correct company scope.



Hidden when All Companies filter would exclude it.

Instruction to v0

Ensure formulas/page.tsx merges listPreviewCreatedFormulas() via mergeFormulasForScope(). Use existing table/card components. Mock preview only.



V0-LIST-02 — List Loading Skeleton







Field



Value





Feature ID



V0-LIST-02





Feature Name



Formula list loading state





Current UI



Instant mock render — no skeleton.





Required UI



Brief skeleton rows on first paint (client suspense).





Visual priority



P2





Implementation priority



P2

Instruction to v0

Add lightweight skeleton to FormulaTable / FormulaCard grid using existing card border styles. No API wiring.



Formula Wizard

V0-WIZ-01 — Create Orchestration Review Step







Field



Value





Feature ID



V0-WIZ-01





Feature Name



Multi-entity create preview on Review step





Why backend requires it



POST /formulas creates formula only; participants, schedules, invoices, logistics, shares are separate POSTs orchestrated by service layer.





Backend source



src/actions/formula.actions.ts, participant.actions.ts, payment.actions.ts, etc.





Current UI



Review shows summary; submit builds single preview Formula object.





Required UI



Review step lists entities to be created as separate backend operations (formula, N participants, M schedules, …) with checkmarks — still one preview submit.





Interaction Flow



Step 5 Review → read-only entity manifest → Submit (Preview) → detail.





Component hierarchy



formula-wizard.tsx Step 5 → CreateManifestPanel





Fields displayed



item_id, trade_type, quantity, unit, participant chain count, optional schedules/invoices/logistics/shares counts.





Visual priority



P1





Implementation priority



P1

Acceptance Criteria





Review lists discrete backend operations that would fire (labels only).



buildCreateFormulaRequest() output shown in collapsible debug strip for architects (optional, muted).

Instruction to v0

Extend Review step in formula-wizard.tsx. Use existing stepper and card styles. Do not implement multi-HTTP. Mock preview only.



V0-WIZ-02 — Metadata Field Alignment (content)







Field



Value





Feature ID



V0-WIZ-02





Feature Name



Spec memo → content labeling





Why backend requires it



PATCH/POST uses content column for spec/quality memo per Prisma.





Backend source



CreateFormulaRequest.content, PATCH metadata





Current UI



Wizard labels "Spec / Quality memo".





Required UI



Keep user-facing label; map to content in buildCreateFormulaRequest() (verify).





Visual priority



P2





Implementation priority



P2

Instruction to v0

Verify wizard-to-formula.ts maps spec memo → content. Align Overview metadata editor label to "Spec / Quality (content)". No API wiring.



Formula Detail — Header

V0-HDR-01 — RBAC: Hide Cancel/Close from MANAGER







Field



Value





Feature ID



V0-HDR-01





Feature Name



Cancel/Close visibility per RBAC matrix





Why backend requires it



cancel:cancel and close:close require COMPANY_ADMIN+ (RBAC_PERMISSION_MATRIX.md §5–§7).





Backend source



POST .../cancel, POST .../close





Current UI



Buttons hidden via canCloseOrCancel for MANAGER — verify MANAGER sees disabled vs hidden.





Required UI



Hide Cancel/Close buttons entirely for MANAGER and VIEWER (not disabled with tooltip).





Permission / RBAC



COMPANY_ADMIN, SUPER_ADMIN only.





Visual priority



P0





Implementation priority



P0

Acceptance Criteria





MANAGER never sees Cancel Formula or Close Formula buttons.



VIEWER never sees them.

Instruction to v0

Update formula-detail-view.tsx header actions to conditionally render (not render) when !caps.canCloseOrCancel. Use existing button variants. Mock only.



Formula Detail — Overview

V0-OVR-01 — Metadata Editor Field Names







Field



Value





Feature ID



V0-OVR-01





Feature Name



Metadata PATCH modal alignment





Why backend requires it



PATCH /formulas/:id accepts unit, content, note only — non-version fields.





Backend source



src/actions/formula.actions.ts patchFormula





Current UI



MetadataWorkflowActions edits unit, specMemo, note — partial.





Required UI



Three fields: Unit, Content (spec/quality), Internal Note. Helper text: "Non-version metadata only."





Validation



Reject empty patch; closed formula blocks edit.





Permission / RBAC



MANAGER+ on open formula (canEditMetadata).





Version impact



None — must not trigger version.





Visual priority



P1





Implementation priority



P1

Instruction to v0

Update MetadataModal in batch-2-workflows.tsx: rename specMemo label to "Content (spec/quality)". Map to patchFormulaMetadataPreview fields. Mock only.



V0-OVR-02 — Six-Status Stubs (G1–G4) — Preserve







Field



Value





Feature ID



V0-OVR-02





Feature Name



Disabled six-status controls for missing routes





Why backend requires it



G1–G4 routes not shipped; UI must not fake completion.





Backend source



Master Plan §10 G1–G4





Current UI



SixStatusControls with API missing disabled buttons — correct.





Required UI



Maintain disabled state + BACKEND_ROUTE_GAPS tooltips. Logistics preview remains only mutator until routes ship.





Visual priority



P0 (preserve)





Implementation priority



P0 (no regression)

Instruction to v0

Do not enable Trade, Cash In, Cash Out, or Delivery write buttons. Keep existing stub copy. Invoice remains derived display only.



Formula Detail — Timeline

V0-TL-01 — Status Log Viewer Subsection







Field



Value





Feature ID



V0-TL-01





Feature Name



Status log table within Timeline





Why backend requires it



formula_status_logs are authoritative status history; timeline must surface them distinctly.





Backend source



Status log rows returned inline on mutations; list API deferred





Current UI



buildTimeline() synthesizes events; type filter chips — partial.





Required UI



Collapsible "Status Logs" table: type, previous → new, memo, actor, timestamp. Filter chip status pre-selects these.





Interaction Flow



Timeline tab → filter Status → table + chronological cards.





Component hierarchy



TimelineWorkflowChrome → StatusLogTable + existing event list





Empty state



"No status changes recorded."





Visual priority



P1





Implementation priority



P1

Acceptance Criteria





Status log rows from formula.statusLogs visible in dedicated table.



Filter status shows only status log events.

Instruction to v0

Extend TimelineWorkflowChrome and TimelinePanel in batch-2-workflows.tsx / detail-panels.tsx. Use existing table border styles from ParticipantsPanel. Mock data from formula.statusLogs. No API wiring.



Formula Detail — Participants

V0-PART-01 — Add Participant (Post-Create)







Field



Value





Feature ID



V0-PART-01





Feature Name



Add participant on Formula Detail





Why backend requires it



POST /api/v1/formulas/:id/participants creates participant and version + snapshot + audit.





Backend source



src/actions/participant.actions.ts CreateParticipantRequest





Current UI



ParticipantsPanel read-only; wizard supports chain at create only.





Required UI



Toolbar: "Add Participant (Preview)" → modal → version confirm → append to chain.





Interaction Flow



Click Add → form → Version impact summary → Confirm → preview updates participants + latestVersionNo bump.





User Journey



Manager adds mid-chain participant after deal evolution.





Component hierarchy



ParticipantsPanel header → ParticipantWorkflowActions → AddParticipantModal → VersionTriggerModal (reuse from shares)





Fields



Company selector (registered companies), sequence_order, role_group, nature_group, payment_group, buy_unit_price, sell_unit_price, quantity, is_start_point, is_end_point, memo





Validation



Cannot add when closed/canceled; start/end point uniqueness message; company required.





Permission / RBAC



MANAGER+ (canWrite); hidden when closed.





Formula impact



Recalculates expected amounts via recomputeFormulaPreview.





Version impact



Required — new version row appended to history.





Timeline impact



New version event + participant_added log.





Settlement impact



None





Future API binding point



POST .../participants + version payload block.





Visual priority



P0





Implementation priority



P0

Acceptance Criteria





Add button visible on open formula for MANAGER+.



Closed formula: no add button.



Version confirm dialog shown before apply.



Participant appears in chain sorted by sequence.

Instruction to v0

Create ParticipantWorkflowActions beside ParticipantsPanel in formula-detail-view.tsx. Reuse VersionTriggerModal pattern from workflow-modals.tsx. Add addParticipantPreview() to formula-preview-mutations.ts. Use company selector from registeredCompanies / useRegisteredCompanies(). Mock preview only. No API wiring.



Formula Detail — Payments

V0-PAY-01 — Payment Record Cancel RBAC







Field



Value





Feature ID



V0-PAY-01





Feature Name



Payment cancel COMPANY_ADMIN only





Why backend requires it



PATCH /payment-records/:id/cancel requires payment:cancel = COMPANY_ADMIN+ per RBAC matrix.





Backend source



src/actions/payment.actions.ts, RBAC_PERMISSION_MATRIX.md





Current UI



Cancel uses canWritePayments (MANAGER+) — wrong.





Required UI



Hide Cancel buttons on records unless roleAtLeast(role, 'COMPANY_ADMIN').





Permission / RBAC



COMPANY_ADMIN, SUPER_ADMIN only for cancel. Register/schedule remain MANAGER+.





Visual priority



P0





Implementation priority



P0

Acceptance Criteria





MANAGER sees Register/Add Schedule but not Cancel on records.



COMPANY_ADMIN sees Cancel.

Instruction to v0

Add canCancelPayment: admin && !isCanceled to FormulaWriteCaps in permissions.ts. Gate PaymentRecordsPanel cancel buttons and CancelRecordModal entry. Hide, don't disable. Mock only.



V0-PAY-02 — Remove Link-Schedule Post-Create Flow







Field



Value





Feature ID



V0-PAY-02





Feature Name



Schedule link only at record registration





Why backend requires it



Backend links payment_schedule_id at create record only — no PATCH on records (G6 adjacent).





Backend source



CreatePaymentRecordRequest.payment_schedule_id





Current UI



LinkScheduleModal as post-create action — wrong semantics.





Required UI



Remove toolbar "Link to Schedule" button. Enhance RegisterRecordModal with required/optional schedule dropdown (already partial). Show read-only link status on unmatched records.





Visual priority



P0





Implementation priority



P0

Acceptance Criteria





No standalone Link modal in toolbar.



Register Record modal includes schedule selector.



Unmatched records show warning badge (existing).

Instruction to v0

Remove LinkScheduleModal and toolbar button from PaymentWorkflowActions. Expand RegisterRecordModal schedule Select to show all open schedules for formula. Mock only.



V0-PAY-03 — Payment Form Field Expansion







Field



Value





Feature ID



V0-PAY-03





Feature Name



Schedule/record forms aligned to backend DTO





Why backend requires it



Create endpoints accept direction, participant_id, counterparty_company_id, bank fields, memos.





Backend source



CreatePaymentScheduleRequest, CreatePaymentRecordRequest





Current UI



Simplified receipt/payment + counterparty string + amount + date.





Required UI



Add: Direction (IN/OUT), Participant picker (from formula participants), Counterparty company picker, Payment type/group, Memo; Record: bank_name, account_name, account_no.





Validation



Amount > 0; actual_date required for records.





Visual priority



P1





Implementation priority



P1

Instruction to v0

Extend AddScheduleModal and RegisterRecordModal fields. Keep modal width consistent; use two-column layout on md+. Store extended fields in preview types. Mock only.



V0-PAY-04 — Closed Formula: Payments Tab Read-Only







Field



Value





Feature ID



V0-PAY-04





Feature Name



Lock Payments tab writes when closed





Why backend requires it



DL-033: open-formula payment writes forbidden when closed; append via Settlement only.





Backend source



closed-formula.guard.ts, DL-033





Current UI



canWritePayments false when closed — verify toolbar hidden.





Required UI



When is_closed, hide entire PaymentWorkflowActions toolbar; show banner "Post-close payment changes → Settlement tab."





Visual priority



P0





Implementation priority



P0

Instruction to v0

In Payments tab content, conditionally render informational banner when formula.isClosed. Ensure no payment write chrome visible. Mock only.



V0-PAY-05 — Closed Formula: Payment Record Cancel on Settlement







Field



Value





Feature ID



V0-PAY-05





Feature Name



Cancel payment record on closed formula





Why backend requires it



DL-033 allowlist: payment_record_cancel permitted on closed formulas (COMPANY_ADMIN+).





Backend source



payment.service.ts closed guard, DL-033





Current UI



Missing — no cancel affordance when closed.





Required UI



On Settlement tab, "Manage Records" section listing records with Cancel (Preview) + reason modal.





Interaction Flow



Settlement → record row → Cancel → reason → preview sets is_canceled on record.





Permission / RBAC



COMPANY_ADMIN+ only (canSettlementAppend or new canCancelPaymentOnClosed).





Settlement impact



Realized profit recalculates excluding canceled record.





Visual priority



P0





Implementation priority



P0

Acceptance Criteria





Closed formula: cancel available on Settlement tab only.



Canceled record remains visible with canceled badge.



409-style message if already canceled (preview idempotent message).

Instruction to v0

Add SettlementRecordCancelSection under SettlementWorkflowActions. Reuse CancelRecordModal. Gate with COMPANY_ADMIN. Mock only.



Formula Detail — Invoices

V0-INV-01 — Invoice Status Update (Enum)







Field



Value





Feature ID



V0-INV-01





Feature Name



Invoice status PATCH UI





Why backend requires it



PATCH /invoices/:id/status accepts { status: InvoiceStatus } only. amount_verified is DB-derived.





Backend source



src/actions/invoice.actions.ts UpdateInvoiceStatusRequest





Current UI



InvoiceStatusModal edits external amount — wrong semantics.





Required UI



Modal: Status enum select (PENDING, ISSUED, RECEIVED, MATCHED, MISMATCHED, CANCELED per Prisma enum). Read-only display of expected amount, external amount, amount_verified after change (preview derivation).





Interaction Flow



Per-invoice "Update Status (Preview)" → select status → save → preview updates invoice.status + formula invoice rollup.





Validation



Cannot edit canceled invoice.





Permission / RBAC



MANAGER+ (canWriteInvoices).





Formula impact



Invoice close contribution may change; six-status invoice chip updates.





Version impact



None





Visual priority



P0





Implementation priority



P0

Acceptance Criteria





No modal field labeled "external amount mode" as status substitute.



Status dropdown matches backend enum values.



Amount verified badge updates from preview derivation, not manual toggle.

Instruction to v0

Replace InvoiceStatusModal in batch-2-workflows.tsx with enum-based status form. Keep separate read-only external amount on invoice create flow. Add updateInvoiceStatusPreview() in mutations. Mock only.



V0-INV-02 — Invoice Create Form Alignment







Field



Value





Feature ID



V0-INV-02





Feature Name



Invoice create DTO fields





Why backend requires it



POST .../invoices requires issuer/receiver company IDs, optional participant IDs, amounts.





Backend source



CreateInvoiceRequest





Current UI



Simplified direction + counterparty string.





Required UI



Issuer company, Receiver company (pickers), optional issuer/receiver participant, invoice_no, invoice_date, external_invoice_amount, supply_amount, tax_amount, memo.





Visual priority



P1





Implementation priority



P1

Instruction to v0

Extend AddInvoiceModal in workflow-modals.tsx. Use registered company list. Mock only.



V0-INV-03 — Closed Formula Invoice Sync







Field



Value





Feature ID



V0-INV-03





Feature Name



Conditional invoice sync on closed formula





Why backend requires it



DL-033: when closed, syncFormulaInvoiceStatus allowed only when derived status is AMOUNT_MATCHED.





Backend source



syncFormulaInvoiceStatus action





Current UI



Missing.





Required UI



On closed formula Invoice rows: read-only + "Sync Formula Invoice Status (Preview)" button when all active invoices matched.





Permission / RBAC



COMPANY_ADMIN+ on closed formula.





Visual priority



P1





Implementation priority



P1

Instruction to v0

Add button to InvoiceStatusActions when formula.isClosed && invoice verification matched. Preview updates formula.invoiceStatus. Mock only.



Formula Detail — Logistics

V0-LOG-01 — Logistics Create Form Alignment







Field



Value





Feature ID



V0-LOG-01





Feature Name



Create logistics leg form





Why backend requires it



POST .../logistics stores carrier companies, ports, total_logistics_cost (version-triggering), vehicle_count.





Backend source



src/actions/logistics.actions.ts





Current UI



Mode/origin/dest/ETA/cost preview leg.





Required UI



Carrier company, departure/arrival company or place, total_logistics_cost, vehicle_count, memo.





Version impact



Cost change triggers version confirm.





Visual priority



P1





Implementation priority



P1

Instruction to v0

Extend Add Leg modal in LogisticsWorkflowActions. Reuse version trigger if cost present. Mock only.



V0-LOG-02 — Vehicle Display (G5 — Read Only)







Field



Value





Feature ID



V0-LOG-02





Feature Name



Vehicle cards under legs





Why backend requires it



G5: backend stores vehicle_count only; row API deferred.





Current UI



Read-only vehicle cards in LogisticsPanel — correct.





Required UI



Maintain read-only display; no Add Vehicle button until G5 ships.





Visual priority



P2 (preserve)





Implementation priority



P2

Instruction to v0

Do not add vehicle CRUD. Keep empty state "No vehicles assigned." Mock only.



Formula Detail — Shares

V0-SHR-01 — Share Editor Backend Alignment







Field



Value





Feature ID



V0-SHR-01





Feature Name



Share CRUD form alignment





Why backend requires it



Share mutations require participant_id or target_company_id, share_basis, share_method, share_rate/share_amount, and version payload.





Backend source



CreateShareRequest, UpdateShareRequest, DeleteShareRequest





Current UI



Free-text company; methods fixed/rate/split — partial.





Required UI



Target: participant picker OR company picker; share_basis select; share_method (FIXED_AMOUNT, RATE, N_OVER_ONE); conditional rate/amount; version impact panel listing snapshot fields.





Version impact



Required on every mutation — keep VersionTriggerModal.





Visual priority



P1





Implementation priority



P1

Acceptance Criteria





share_method values labeled matching backend enums.



Version confirm shows totalShare before/after.

Instruction to v0

Upgrade ShareEditorModal in workflow-modals.tsx. Add read-only "Version payload preview" JSON panel (muted) showing snapshot/calculation shape. Mock only.



Formula Detail — Versions

V0-VER-01 — Version Commit Payload Preview







Field



Value





Feature ID



V0-VER-01





Feature Name



Version commit confirmation panel





Why backend requires it



POST .../versions requires calculation snapshot body alongside version row.





Backend source



src/actions/version.actions.ts





Current UI



Commit button + summary — partial.





Required UI



Commit modal sections: Trigger fields, Snapshot preview (quantity, totalBuy, totalSell, totalCost, totalShare, netProfit), Calculation preview, Audit note.





Version impact



Creates new version_no.





Visual priority



P1





Implementation priority



P1

Instruction to v0

Extend commit modal in formula-edit-simulation.tsx. Display snapshot fields from simulateFormulaEdit output. Mock only.



V0-VER-02 — Version Triggers Beyond Qty/Price







Field



Value





Feature ID



V0-VER-02





Feature Name



Document version triggers in UI legend only





Why backend requires it



Version triggered by participants, FX, logistics cost, shares — UI cannot fake all editors yet.





Current UI



Legend lists triggers; only qty/price simulation + share commits.





Required UI



Keep legend accurate; add "Coming when domain editor exists" tooltips on absent triggers.





Visual priority



P2





Implementation priority



P2

Instruction to v0

Add non-interactive legend rows in VersionsPanel for triggers not yet editable. Do not invent editors. Mock only.



Formula Detail — Settlement

V0-SET-01 — Closed Settlement Chrome (DL-033)







Field



Value





Feature ID



V0-SET-01





Feature Name



Distinct post-close settlement workspace





Why backend requires it



DL-033 requires users know they are in append-only correction, not trade edit.





Backend source



FORMULA_DETAIL_SPEC.md §3.5.2





Current UI



SettlementWorkflowActions toolbar — partial.





Required UI



Persistent banner on Settlement tab when closed: lock icon + "Original trade locked — append-only settlement corrections." Different border color (accent-soft).





Visual priority



P0





Implementation priority



P0

Instruction to v0

Add ClosedSettlementBanner at top of Settlement tab when formula.isClosed. Use existing Lock icon and accent-soft styles. Mock only.



V0-SET-02 — Settlement Append Form Fields







Field



Value





Feature ID



V0-SET-02





Feature Name



Settlement-specific append forms





Why backend requires it



POST .../settlement/payment-schedules and POST .../settlement/notes have dedicated DTOs.





Backend source



src/actions/settlement.actions.ts





Current UI



Reuses generic payment schedule modal — partial.





Required UI



Closed schedule: direction, participant_id, due_date, scheduled_amount, memo. Note: text + category "issue".





Permission / RBAC



COMPANY_ADMIN+ (canSettlementAppend).





Visual priority



P1





Implementation priority



P1

Instruction to v0

Differentiate ClosedScheduleModal labels from open-formula schedule modal. Add addSettlementSchedulePreview() separate from open schedule in mutations. Mock only.



Reports

V0-RPT-01 — Perspective Context Chips







Field



Value





Feature ID



V0-RPT-01





Feature Name



Reports perspective clarity





Current UI



AnalyticsCompanyFilter — mostly complete.





Required UI



Visible chip: "Analyzing as [Company X]" when perspective ≠ operating scope.





Visual priority



P2





Implementation priority



P2

Instruction to v0

Add context chip to reports-workspace.tsx matching formulas list pattern. Mock only.



Calendar

V0-CAL-01 — Schedule Event Drill-Down







Field



Value





Feature ID



V0-CAL-01





Feature Name



Calendar event → formula link





Why backend requires it



Calendar events are payment schedules derived from formulas.





Current UI



Month grid — verify click navigates to formula payments tab.





Required UI



Click event → /formulas/[id]?tab=payments (or tab state).





Visual priority



P2





Implementation priority



P2

Instruction to v0

Wire calendar cell events to formula detail with payments tab selected. Mock only.



Companies

V0-CO-01 — Company Edit/Delete Mock Labeling







Field



Value





Feature ID



V0-CO-01





Feature Name



Honest mock labeling for unsupported mutations





Why backend requires it



G9 — no PATCH/DELETE /companies. UI must not imply persistence.





Backend source



Master Plan G9





Current UI



Edit/archive/delete appear operational — wrong.





Required UI



Edit/Archive buttons show badge "Preview only — no company update API". Or hide edit/delete until G9 ships (product choice: hide recommended).





Visual priority



P0





Implementation priority



P0

Acceptance Criteria





Users cannot believe company edit persists to backend.



Create company remains available (POST exists).

Instruction to v0

Either hide Edit/Archive/Delete in companies-explorer.tsx OR add prominent MockPreviewNote in those modals. Prefer hide for MANAGER; keep create. Mock only.



Items

V0-ITEM-01 — Item Picker UUID Semantics







Field



Value





Feature ID



V0-ITEM-01





Feature Name



Item selection uses item_id





Why backend requires it



POST /formulas requires item_id UUID FK — not free text.





Backend source



G8 deferral — mock catalog OK





Current UI



Wizard item select uses mock it-* IDs — correct for mock.





Required UI



Show item code + name; store item_id in create request. Read-only on detail.





Visual priority



P2





Implementation priority



P2

Instruction to v0

Verify wizard and detail display item_id mapping in review manifest. Mock only.



Cross-Formula Workspace Pages

V0-WS-PAY — Payments Workspace







Field



Value





Feature ID



V0-WS-PAY





Feature Name



/payments cross-formula desk





Why backend requires it



Operators reconcile schedules/records across formulas; read routes are scoped list endpoints.





Backend source



Payment GET routes scoped by company





Current UI



ComingSoon placeholder.





Required UI



Table: formula_no, counterparty, direction, amount, scheduled/paid date, status, link to formula payments tab. Filters: direction, unmatched, date range.





Interaction Flow



Shell → Payments → filter → row click → formula detail payments tab.





Component hierarchy



web/app/payments/page.tsx → PaymentsWorkspace → reuse FormulaTable row link pattern





Empty state



"No payment schedules in scope."





Permission / RBAC



VIEWER read; write actions deep-link to formula only.





Visual priority



P1





Implementation priority



P1

Instruction to v0

Replace ComingSoon in payments/page.tsx with read-only workspace aggregating mock schedules/records across getAnalyticsFormulas(). No write buttons on this page. Mock only.



V0-WS-INV — Invoices Workspace







Field



Value





Feature ID



V0-WS-INV





Feature Name



/invoices cross-formula desk





Current UI



ComingSoon.





Required UI



Table: formula_no, issuer, receiver, status, amount_verified, external amount, due date. Filter: unmatched, pending.





Visual priority



P1





Implementation priority



P1

Instruction to v0

Replace ComingSoon in invoices/page.tsx. Read-only. Link rows to formula invoices tab. Mock only.



V0-WS-LOG — Logistics Workspace







Field



Value





Feature ID



V0-WS-LOG





Feature Name



/logistics cross-formula desk





Current UI



ComingSoon.





Required UI



Table: formula_no, mode, status, ETA, carrier, cost. Filter: in_transit.





Visual priority



P1





Implementation priority



P1

Instruction to v0

Replace ComingSoon in logistics/page.tsx. Read-only. Mock only.



V0-WS-SET — Settlement Workspace







Field



Value





Feature ID



V0-WS-SET





Feature Name



/settlement cross-formula desk





Why backend requires it



Surfaces receivable/payable across formulas from KPI views.





Current UI



ComingSoon.





Required UI



Table of formulas with receivable/payable > 0; closeable flag; link to settlement tab.





Visual priority



P1





Implementation priority



P1

Instruction to v0

Replace ComingSoon in settlement/page.tsx. Use deriveSettlement per formula. Mock only.



Global Search

V0-SEARCH-01 — Command Palette







Field



Value





Feature ID



V0-SEARCH-01





Feature Name



Global search (⌘K)





Why backend requires it



GET /formulas/by-formula-no/:no + list filters — users need quick formula jump.





Current UI



Header search button is non-interactive.





Required UI



Modal palette: search formula_no, item, participant name; results list → navigate detail. Client-side on mock data for MVP.





Interaction Flow



⌘K or click search → type → select result → navigate.





Empty state



"No formulas match."





Visual priority



P2





Implementation priority



P2

Instruction to v0

Add SearchCommandPalette triggered from header.tsx. Use existing Modal or radix-style dialog. Search getFormulasByCompany(selected.id). Mock only.



Notifications

V0-NOTIF-01 — Notification Bell (Deferred)







Field



Value





Feature ID



V0-NOTIF-01





Feature Name



Notifications





Backend source



V2 deferred per spec





Current UI



Decorative bell with badge.





Required UI



No new work — add tooltip "Notifications — coming in V2".





Visual priority



V2





Implementation priority



Deferred

Instruction to v0

Add tooltip to bell icon only. Do not build notification center.



Settings

V0-SETT-01 — Settings Placeholder







Field



Value





Feature ID



V0-SETT-01





Feature Name



Settings page





Current UI



ComingSoon — acceptable (no backend settings API).





Required UI



Keep Coming Soon unless product adds settings scope.





Implementation priority



Deferred



Master Development Queue

P0 — Must complete before UI sign-off







ID



Feature



Complexity



Dependencies



Blocking



Expected files



Expected components





V0-AUTH-01



Route guard



S



AuthProvider



None



shell-wrapper.tsx, new auth-guard.tsx



AuthGuard





V0-HDR-01



Hide cancel/close from MANAGER



S



permissions.ts



None



formula-detail-view.tsx



—





V0-PART-01



Add participant on detail



L



VersionTriggerModal, mutations



None



workflow-modals.tsx or participant-workflows.tsx, formula-preview-mutations.ts, formula-detail-view.tsx



ParticipantWorkflowActions, AddParticipantModal





V0-INV-01



Invoice status enum modal



M



invoice mutations



None



batch-2-workflows.tsx, formula-preview-mutations.ts



InvoiceStatusModal (rewritten)





V0-PAY-01



Payment cancel RBAC



S



permissions.ts



None



permissions.ts, workflow-modals.tsx, detail-panels.tsx



—





V0-PAY-02



Remove link-schedule flow



S



RegisterRecordModal



V0-PAY-03 partial



workflow-modals.tsx



—





V0-PAY-04



Closed payments tab lock



S



is_closed



None



formula-detail-view.tsx



ClosedPaymentsBanner





V0-PAY-05



Closed record cancel on settlement



M



CancelRecordModal



V0-PAY-01



batch-2-workflows.tsx



SettlementRecordCancelSection





V0-SET-01



Closed settlement banner



S



None



None



formula-detail-view.tsx, batch-2-workflows.tsx



ClosedSettlementBanner





V0-CO-01



Company edit honesty



S



None



None



companies-explorer.tsx



—





V0-LIST-01



Wizard formula in list



S



preview session



None



formulas/page.tsx



—





V0-OVR-02



Preserve G1–G4 stubs



S



None



Product D3



workflow-modals.tsx



— (regression test)

P0 complexity key: S = 0.5–1 day, M = 1–2 days, L = 2–3 days (v0 batches).



P1 — Complete after P0







ID



Feature



Complexity



Dependencies



Blocking



Expected files



Expected components





V0-AUTH-02



Header hydration



S



V0-AUTH-01



None



header.tsx



AuthUserChip





V0-PAY-03



Payment form fields



M



company/participant pickers



None



workflow-modals.tsx, types.ts



—





V0-INV-02



Invoice create form



M



company pickers



V0-INV-01



workflow-modals.tsx



AddInvoiceModal





V0-INV-03



Closed invoice sync



S



V0-INV-01



None



batch-2-workflows.tsx



—





V0-LOG-01



Logistics form



M



version trigger



None



workflow-modals.tsx



—





V0-SHR-01



Share editor alignment



L



participant picker



None



workflow-modals.tsx



ShareEditorModal





V0-VER-01



Version commit payload UI



M



edit simulation



None



formula-edit-simulation.tsx



—





V0-SET-02



Settlement append forms



M



V0-SET-01



None



batch-2-workflows.tsx, formula-preview-mutations.ts



—





V0-TL-01



Status log table



M



Timeline filters



None



detail-panels.tsx, batch-2-workflows.tsx



StatusLogTable





V0-WIZ-01



Review manifest



M



wizard-to-formula



None



formula-wizard.tsx



CreateManifestPanel





V0-WS-PAY



Payments workspace



L



list patterns



P0



payments/page.tsx, new payments-workspace.tsx



PaymentsWorkspace





V0-WS-INV



Invoices workspace



M



—



P0



invoices/page.tsx



InvoicesWorkspace





V0-WS-LOG



Logistics workspace



M



—



P0



logistics/page.tsx



LogisticsWorkspace





V0-WS-SET



Settlement workspace



M



deriveSettlement



P0



settlement/page.tsx



SettlementWorkspace





V0-OVR-01



Metadata content label



S



—



None



batch-2-workflows.tsx



—



P2 — Polish







ID



Feature



Complexity



Dependencies



Expected files





V0-SEARCH-01



Command palette



M



header



header.tsx, search-command.tsx





V0-LIST-02



List skeleton



S



—



formula-table.tsx





V0-DASH-01



Drill-down params



S



—



dashboard/*





V0-RPT-01



Reports chips



S



—



reports-workspace.tsx





V0-CAL-01



Calendar drill-down



S



—



calendar/page.tsx





V0-VER-02



Version trigger legend



S



—



versions-panel.tsx





V0-LOG-02



Vehicle read-only



S



—



detail-panels.tsx





V0-ITEM-01



Item UUID display



S



—



formula-wizard.tsx





V0-WIZ-02



content mapping



S



—



wizard-to-formula.ts



Deferred / Do Not Implement (v0)







Item



Reason





G1–G4 status routes UI enablement



Backend gap — keep stubs





G5 vehicle CRUD



Backend gap





G6 payment schedule PATCH



Backend gap





G7 invoice amount PATCH



Backend gap





G9 company PATCH



Backend gap — hide edit





Participant update/delete on detail



Backend V2





Audit log list viewer



Backend gap





Notifications center



V2





Wizard draft save



V2





API HTTP wiring



Out of scope



Document Control







Version



Date



Author



Notes





v1.0.0



2026-07-07



Architect audit



Initial v0 instruction set from Backend vs UI comparison

Handoff: Send this file to v0 verbatim. v0 implements UI only per §0 constraints. Architect re-audits after v0 delivery.