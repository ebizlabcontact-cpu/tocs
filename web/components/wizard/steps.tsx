"use client"

import { Fragment } from "react"
import { Plus, Trash2, ArrowDown, ArrowRight, Link2, Pencil, Flag, FlagOff, Wallet } from "lucide-react"
import { companies, registeredCompanies } from "@/lib/mock-data"
import { getItem, items, unitOptions } from "@/lib/items"
import { tradeTypeConfig } from "@/lib/status"
import type { TradeType } from "@/lib/types"
import { Field, Input, Select, Label } from "@/components/ui/field"
import { Button } from "@/components/ui/button"
import { formatCurrency, uid } from "@/lib/utils"
import {
  roleGroupOptions,
  natureGroupOptions,
  paymentGroupOptions,
  deriveFormula,
  type WizardState,
} from "./types"
import { SettlementScenarios } from "./settlement-scenarios"

type Setter = (updater: (s: WizardState) => WizardState) => void

/** Reusable dropdown for picking a registered company. */
function CompanySelect({
  value,
  onChange,
  className,
  placeholderLabel = "Select company…",
}: {
  value: string
  onChange: (v: string) => void
  className?: string
  placeholderLabel?: string
}) {
  return (
    <Select className={className} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{placeholderLabel}</option>
      {registeredCompanies.map((c) => (
        <option key={c.id} value={c.name}>
          {c.name}
          {c.nature ? ` · ${c.nature}` : ""}
          {c.status === "inactive" ? " (inactive)" : ""}
        </option>
      ))}
    </Select>
  )
}

function NumField({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (v: number) => void
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <Input type="number" value={value || ""} placeholder="0" onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  )
}

/* Step 1 — Basic Information */
export function StepBasics({ state, set }: { state: WizardState; set: Setter }) {
  const item = getItem(state.itemId)

  function selectItem(id: string) {
    const picked = getItem(id)
    set((s) => ({
      ...s,
      itemId: id,
      item: picked?.name ?? "",
      unit: picked?.unit ?? s.unit,
      // Prefill the spec / quality memo from the item's default (still editable).
      specMemo: picked?.specMemo ?? s.specMemo,
    }))
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Company" className="sm:col-span-2">
          <Select value={state.companyId} onChange={(e) => set((s) => ({ ...s, companyId: e.target.value }))}>
            {companies
              .filter((c) => c.id !== "all")
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </Select>
        </Field>

        <Field label="Item" hint={item ? item.category : undefined}>
          <Select value={state.itemId} onChange={(e) => selectItem(e.target.value)}>
            <option value="">Select an item…</option>
            {items.map((it) => (
              <option key={it.id} value={it.id}>
                {it.name}
              </option>
            ))}
          </Select>
        </Field>

        <div className="grid grid-cols-[1fr_auto] gap-3">
          <Field label="Quantity">
            <Input
              type="number"
              value={state.quantity || ""}
              placeholder="0"
              onChange={(e) => set((s) => ({ ...s, quantity: Number(e.target.value) }))}
            />
          </Field>
          <Field label="Unit">
            <Select
              className="w-24"
              value={state.unit}
              onChange={(e) => set((s) => ({ ...s, unit: e.target.value }))}
            >
              {unitOptions.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </div>

      <Field label="Trade Type">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(Object.keys(tradeTypeConfig) as TradeType[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => set((s) => ({ ...s, tradeType: t }))}
              className={
                "rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors " +
                (state.tradeType === t
                  ? "border-accent bg-accent-soft text-accent"
                  : "border-border bg-card text-muted-foreground hover:text-foreground")
              }
            >
              {tradeTypeConfig[t].label}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Spec / Quality Memo" hint="Free text — quality criteria differ per item, so there are no structured spec fields.">
        <textarea
          value={state.specMemo}
          onChange={(e) => set((s) => ({ ...s, specMemo: e.target.value }))}
          rows={3}
          className="w-full rounded-[var(--radius-md)] border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none focus:ring-2 focus:ring-ring/40"
          placeholder="e.g. FFA ≤ 3.5%, Moisture ≤ 1%, Impurity ≤ 0.5%, ISCC eligible, Vietnam origin"
        />
      </Field>

      <Field label="Internal Memo (optional)">
        <textarea
          value={state.internalMemo}
          onChange={(e) => set((s) => ({ ...s, internalMemo: e.target.value }))}
          rows={2}
          className="w-full rounded-[var(--radius-md)] border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none focus:ring-2 focus:ring-ring/40"
          placeholder="Internal notes for your team (not shared externally)…"
        />
      </Field>
    </div>
  )
}

/* Step 2 — Trade Chain (commercial chain: who trades with whom, quantity, prices) */
function ChainConnector() {
  return (
    <div className="flex justify-center py-1" aria-hidden>
      <ArrowDown className="size-4 text-muted-foreground/60" />
    </div>
  )
}

function ToggleChip({
  active,
  onClick,
  children,
  icon: Icon,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
  icon: typeof Flag
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors " +
        (active
          ? "border-accent bg-accent-soft text-accent"
          : "border-border bg-card text-muted-foreground hover:text-foreground")
      }
    >
      <Icon className="size-3.5" />
      {children}
    </button>
  )
}

/** Derived trade-flow strip: revenue → cost → margin, all from chain inputs. */
function TradeFlowStrip({ state }: { state: WizardState }) {
  const d = deriveFormula(state)
  return (
    <div className="rounded-xl border border-border bg-secondary/40 p-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Trade Flow</p>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <FlowPill label="Expected Revenue" value={d.expectedRevenue} tone="pos" />
        <ArrowRight className="size-4 shrink-0 text-muted-foreground/60" aria-hidden />
        <FlowPill label="Expected Cost" value={d.expectedCost} />
        <ArrowRight className="size-4 shrink-0 text-muted-foreground/60" aria-hidden />
        <FlowPill label="Chain Margin" value={d.expectedRevenue - d.expectedCost} tone={d.expectedRevenue - d.expectedCost >= 0 ? "pos" : "neg"} bold />
      </div>
    </div>
  )
}

function FlowPill({
  label,
  value,
  tone,
  bold,
}: {
  label: string
  value: number
  tone?: "pos" | "neg"
  bold?: boolean
}) {
  return (
    <span className="inline-flex flex-col rounded-lg border border-border bg-card px-3 py-1.5">
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>
      <span
        className={
          "font-mono tabular-nums " +
          (bold ? "text-sm font-bold " : "text-xs font-medium ") +
          (tone === "pos" ? "text-success" : tone === "neg" ? "text-danger" : "text-foreground")
        }
      >
        {formatCurrency(value)}
      </span>
    </span>
  )
}

export function StepTradeChain({ state, set }: { state: WizardState; set: Setter }) {
  const update = (id: string, patch: Partial<WizardState["participants"][number]>) =>
    set((s) => ({
      ...s,
      participants: s.participants.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    }))

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Build the commercial chain top-to-bottom: who trades with whom, what quantity moves, and at what prices.
        Roles and terms are specific to this formula. Supports up to 5 companies.
      </p>

      <div className="rounded-xl border border-border bg-secondary/30 p-4">
        <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <Link2 className="size-3.5 text-accent" />
          Trade Chain
        </div>

        <div className="flex flex-col">
          {state.participants.map((p, i) => {
            const nodeMargin = (p.sellPrice || 0) * (p.quantity || 0) - (p.buyPrice || 0) * (p.quantity || 0)
            return (
              <Fragment key={p.id}>
                {i > 0 && <ChainConnector />}
                <div className="rounded-lg border border-border bg-card p-3">
                  {/* Row 1: sequence + company + remove */}
                  <div className="flex items-center gap-2">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent-soft font-mono text-xs font-semibold text-accent">
                      {String.fromCharCode(65 + i)}
                    </div>
                    <CompanySelect
                      className="min-w-0 flex-1"
                      value={p.company}
                      onChange={(v) => update(p.id, { company: v })}
                      placeholderLabel={`Select company ${String.fromCharCode(65 + i)}…`}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      type="button"
                      className="shrink-0"
                      disabled={state.participants.length <= 1}
                      onClick={() => set((s) => ({ ...s, participants: s.participants.filter((x) => x.id !== p.id) }))}
                      aria-label={`Remove ${p.company || `company ${i + 1}`}`}
                    >
                      <Trash2 className="size-4 text-muted-foreground" />
                    </Button>
                  </div>

                  {/* Row 2: role / nature / payment groups */}
                  <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <label className="block">
                      <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        Role
                      </span>
                      <Select value={p.natureGroup} onChange={(e) => update(p.id, { natureGroup: e.target.value })}>
                        {natureGroupOptions.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </Select>
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        Role Group
                      </span>
                      <Select value={p.roleGroup} onChange={(e) => update(p.id, { roleGroup: e.target.value })}>
                        {roleGroupOptions.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </Select>
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        Payment
                      </span>
                      <Select value={p.paymentGroup} onChange={(e) => update(p.id, { paymentGroup: e.target.value })}>
                        {paymentGroupOptions.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </Select>
                    </label>
                  </div>

                  {/* Row 3: quantity / buy / sell prices */}
                  <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <NumField label="Quantity" value={p.quantity} onChange={(v) => update(p.id, { quantity: v })} />
                    <NumField label="Buy Price" value={p.buyPrice} onChange={(v) => update(p.id, { buyPrice: v })} />
                    <NumField label="Sell Price" value={p.sellPrice} onChange={(v) => update(p.id, { sellPrice: v })} />
                  </div>

                  {/* Node margin + endpoints */}
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        Endpoints
                      </span>
                      <ToggleChip
                        active={p.startPoint}
                        onClick={() => update(p.id, { startPoint: !p.startPoint })}
                        icon={Flag}
                      >
                        Start
                      </ToggleChip>
                      <ToggleChip
                        active={p.endPoint}
                        onClick={() => update(p.id, { endPoint: !p.endPoint })}
                        icon={FlagOff}
                      >
                        End
                      </ToggleChip>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      Node margin{" "}
                      <span className={"font-mono font-semibold " + (nodeMargin >= 0 ? "text-success" : "text-danger")}>
                        {formatCurrency(nodeMargin)}
                      </span>
                    </span>
                  </div>
                </div>
              </Fragment>
            )
          })}
        </div>

        <Button
          variant="subtle"
          type="button"
          className="mt-3 w-full"
          disabled={state.participants.length >= 5}
          onClick={() =>
            set((s) => ({
              ...s,
              participants: [
                ...s.participants,
                {
                  id: uid(),
                  company: "",
                  roleGroup: "buyer",
                  natureGroup: "distributor",
                  paymentGroup: "credit",
                  quantity: s.quantity || 0,
                  buyPrice: 0,
                  sellPrice: 0,
                  startPoint: false,
                  endPoint: false,
                },
              ],
            }))
          }
        >
          <Plus className="size-4" />
          {state.participants.length >= 5 ? "Maximum 5 companies" : "Add to chain"}
        </Button>
      </div>

      <TradeFlowStrip state={state} />
    </div>
  )
}

/* Step 3 — Settlement Terms (money flow conditions, all derived from the chain) */
function MoneyFlow({ state }: { state: WizardState }) {
  const d = deriveFormula(state)
  return (
    <div className="rounded-xl border border-border bg-secondary/40 p-4">
      <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Wallet className="size-3.5 text-accent" />
        Money Flow
      </div>
      <div className="space-y-2.5">
        <MoneyRow label="Expected Receipts" value={d.expectedReceipts} tone="pos" />
        <MoneyRow label="Expected Payments" value={d.expectedPayments} minus />
        <MoneyRow label="Costs" value={d.costs} minus />
        <div className="border-t border-dashed border-border pt-2.5">
          <MoneyRow label="Gross Margin" value={d.grossMargin} tone={d.grossMargin >= 0 ? "pos" : "neg"} bold />
        </div>
        <MoneyRow label={`Share (${state.sharePct}%)`} value={d.retainedShare} tone={d.retainedShare >= 0 ? "pos" : "neg"} />
      </div>
      <div className="mt-3 rounded-lg bg-card p-3">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Expected Profit</p>
        <p className={"mt-1 font-mono text-2xl font-bold tabular-nums " + (d.expectedProfit >= 0 ? "text-success" : "text-danger")}>
          {formatCurrency(d.expectedProfit)}
        </p>
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
        Expected profit is derived from formula inputs. Realized profit is calculated only from actual receipts and
        payments after settlement.
      </p>
    </div>
  )
}

function MoneyRow({
  label,
  value,
  tone,
  minus,
  bold,
}: {
  label: string
  value: number
  tone?: "pos" | "neg"
  minus?: boolean
  bold?: boolean
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={
          "font-mono tabular-nums " +
          (bold ? "font-bold " : "font-medium ") +
          (tone === "pos" ? "text-success" : tone === "neg" ? "text-danger" : "text-foreground")
        }
      >
        {minus && value > 0 ? "−" : ""}
        {formatCurrency(Math.abs(value))}
      </span>
    </div>
  )
}

export function StepSettlement({ state, set }: { state: WizardState; set: Setter }) {
  const d = deriveFormula(state)
  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Define money-flow conditions. Receipts, payments, and profit are derived from the trade chain — set costs,
        your share, and any planned settlement timing here.
      </p>

      {/* Costs */}
      <div className="space-y-3">
        <Label>Costs (optional)</Label>
        {state.costs.map((c) => (
          <div key={c.id} className="grid gap-3 rounded-lg border border-border bg-card p-4 sm:grid-cols-[1fr_auto_auto]">
            <Input
              value={c.label}
              placeholder="Cost label (e.g. Insurance, Freight)"
              onChange={(e) =>
                set((s) => ({ ...s, costs: s.costs.map((x) => (x.id === c.id ? { ...x, label: e.target.value } : x)) }))
              }
            />
            <Input
              type="number"
              value={c.amount || ""}
              placeholder="0"
              className="w-32"
              onChange={(e) =>
                set((s) => ({
                  ...s,
                  costs: s.costs.map((x) => (x.id === c.id ? { ...x, amount: Number(e.target.value) } : x)),
                }))
              }
            />
            <Button
              variant="ghost"
              size="icon"
              type="button"
              onClick={() => set((s) => ({ ...s, costs: s.costs.filter((x) => x.id !== c.id) }))}
              aria-label="Remove cost"
            >
              <Trash2 className="size-4 text-muted-foreground" />
            </Button>
          </div>
        ))}
        <Button
          variant="subtle"
          type="button"
          onClick={() => set((s) => ({ ...s, costs: [...s.costs, { id: uid(), label: "", amount: 0 }] }))}
        >
          <Plus className="size-4" />
          Add cost
        </Button>
      </div>

      {/* Retained share */}
      <Field label={`Retained share — ${state.sharePct}%`} hint="Your entitled portion of the margin. The remainder is treated as optional share.">
        <input
          type="range"
          min={0}
          max={100}
          value={state.sharePct}
          onChange={(e) => set((s) => ({ ...s, sharePct: Number(e.target.value) }))}
          className="w-full accent-[var(--accent)]"
        />
      </Field>

      {/* Derived money flow */}
      <MoneyFlow state={state} />

      {/* Settlement scenario demonstration */}
      <div className="rounded-xl border border-border bg-card p-4">
        <SettlementScenarios expectedReceipts={d.expectedReceipts} expectedPayments={d.expectedPayments} />
      </div>

      {/* Planned settlement timing (optional) */}
      <div className="space-y-3">
        <Label>Planned Settlement Timing (optional)</Label>
        <p className="text-xs text-muted-foreground">
          Optional expected dates for receipts and payments. Actual records are entered after the formula is created —
          nothing here creates a real payment record.
        </p>
        {state.schedule.length === 0 && (
          <div className="rounded-lg border border-dashed border-border py-6 text-center text-sm text-muted-foreground">
            No planned settlement dates yet.
          </div>
        )}
        {state.schedule.map((item) => (
          <div key={item.id} className="grid gap-3 rounded-lg border border-border bg-card p-4 sm:grid-cols-[auto_1fr_auto_auto_auto]">
            <Select
              value={item.type}
              className="w-32"
              onChange={(e) =>
                set((s) => ({
                  ...s,
                  schedule: s.schedule.map((x) =>
                    x.id === item.id ? { ...x, type: e.target.value as "receipt" | "payment" } : x,
                  ),
                }))
              }
            >
              <option value="receipt">Incoming (Receipt)</option>
              <option value="payment">Outgoing (Payment)</option>
            </Select>
            <Input
              value={item.counterparty}
              placeholder="Counterparty"
              onChange={(e) =>
                set((s) => ({
                  ...s,
                  schedule: s.schedule.map((x) => (x.id === item.id ? { ...x, counterparty: e.target.value } : x)),
                }))
              }
            />
            <Input
              type="number"
              value={item.amount || ""}
              placeholder="Amount"
              className="w-36"
              onChange={(e) =>
                set((s) => ({
                  ...s,
                  schedule: s.schedule.map((x) => (x.id === item.id ? { ...x, amount: Number(e.target.value) } : x)),
                }))
              }
            />
            <Input
              type="date"
              value={item.dueDate}
              className="w-40"
              onChange={(e) =>
                set((s) => ({
                  ...s,
                  schedule: s.schedule.map((x) => (x.id === item.id ? { ...x, dueDate: e.target.value } : x)),
                }))
              }
            />
            <Button
              variant="ghost"
              size="icon"
              type="button"
              onClick={() => set((s) => ({ ...s, schedule: s.schedule.filter((x) => x.id !== item.id) }))}
              aria-label="Remove schedule item"
            >
              <Trash2 className="size-4 text-muted-foreground" />
            </Button>
          </div>
        ))}
        <Button
          variant="subtle"
          type="button"
          onClick={() =>
            set((s) => ({
              ...s,
              schedule: [...s.schedule, { id: uid(), type: "receipt", counterparty: "", amount: 0, dueDate: "" }],
            }))
          }
        >
          <Plus className="size-4" />
          Add planned date
        </Button>
      </div>
    </div>
  )
}

/* Step 4 — Logistics */
const logisticsModes = [
  { value: "sea", label: "Sea" },
  { value: "air", label: "Air" },
  { value: "land", label: "Land" },
] as const

export function StepLogistics({ state, set }: { state: WizardState; set: Setter }) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Add routing for goods moving through the deal. Logistics companies can be picked from registered companies.
      </p>
      {state.logistics.length === 0 && (
        <div className="rounded-lg border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
          No shipment legs yet.
        </div>
      )}
      {state.logistics.map((leg) => (
        <div
          key={leg.id}
          className="grid gap-3 rounded-lg border border-border bg-card p-4 sm:grid-cols-[auto_1fr_1fr_auto_auto]"
        >
          <Select
            value={leg.mode}
            className="w-28"
            onChange={(e) =>
              set((s) => ({
                ...s,
                logistics: s.logistics.map((x) =>
                  x.id === leg.id ? { ...x, mode: e.target.value as "sea" | "air" | "land" } : x,
                ),
              }))
            }
          >
            {logisticsModes.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </Select>
          <Input
            value={leg.origin}
            placeholder="Origin"
            onChange={(e) =>
              set((s) => ({
                ...s,
                logistics: s.logistics.map((x) => (x.id === leg.id ? { ...x, origin: e.target.value } : x)),
              }))
            }
          />
          <Input
            value={leg.destination}
            placeholder="Destination"
            onChange={(e) =>
              set((s) => ({
                ...s,
                logistics: s.logistics.map((x) => (x.id === leg.id ? { ...x, destination: e.target.value } : x)),
              }))
            }
          />
          <Input
            type="date"
            value={leg.eta}
            className="w-40"
            aria-label="ETA"
            onChange={(e) =>
              set((s) => ({
                ...s,
                logistics: s.logistics.map((x) => (x.id === leg.id ? { ...x, eta: e.target.value } : x)),
              }))
            }
          />
          <Button
            variant="ghost"
            size="icon"
            type="button"
            onClick={() => set((s) => ({ ...s, logistics: s.logistics.filter((x) => x.id !== leg.id) }))}
            aria-label="Remove shipment leg"
          >
            <Trash2 className="size-4 text-muted-foreground" />
          </Button>
        </div>
      ))}
      <Button
        variant="subtle"
        type="button"
        onClick={() =>
          set((s) => ({
            ...s,
            logistics: [...s.logistics, { id: uid(), mode: "sea", origin: "", destination: "", eta: "" }],
          }))
        }
      >
        <Plus className="size-4" />
        Add shipment leg
      </Button>
    </div>
  )
}

/* Step 5 — Review */
export function StepReview({
  state,
  goTo,
}: {
  state: WizardState
  set: Setter
  goTo?: (step: number) => void
}) {
  const company = companies.find((c) => c.id === state.companyId)
  const d = deriveFormula(state)

  return (
    <div className="space-y-4">
      {/* Basic information */}
      <ReviewSection title="Basic Information" step={1} goTo={goTo}>
        <div className="grid gap-3 sm:grid-cols-2">
          <ReviewItem label="Company" value={company?.name ?? "—"} />
          <ReviewItem label="Item" value={state.item || "—"} />
          <ReviewItem label="Quantity" value={state.quantity ? `${state.quantity} ${state.unit}` : "—"} />
          <ReviewItem label="Trade Type" value={tradeTypeConfig[state.tradeType].label} />
        </div>
        <ReviewText label="Spec / Quality Memo" value={state.specMemo} />
        {state.internalMemo ? <ReviewText label="Internal Memo" value={state.internalMemo} /> : null}
      </ReviewSection>

      {/* Trade chain */}
      <ReviewSection title="Trade Chain" step={2} goTo={goTo}>
        {state.participants.length === 0 ? (
          <p className="text-sm text-muted-foreground">No participants added.</p>
        ) : (
          <ol className="space-y-1.5">
            {state.participants.map((p, i) => {
              const role = natureGroupOptions.find((o) => o.value === p.natureGroup)?.label ?? p.natureGroup
              const totalSell = (p.sellPrice || 0) * (p.quantity || 0)
              const totalBuy = (p.buyPrice || 0) * (p.quantity || 0)
              return (
                <li key={p.id} className="flex items-center gap-2 text-sm">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent-soft font-mono text-[11px] font-semibold text-accent">
                    {String.fromCharCode(65 + i)}
                  </span>
                  <span className="font-medium text-foreground">{p.company || "—"}</span>
                  <span className="text-muted-foreground">· {role}</span>
                  <span className="ml-auto shrink-0 font-mono text-xs text-muted-foreground">
                    Buy {formatCurrency(totalBuy)} · Sell {formatCurrency(totalSell)}
                  </span>
                </li>
              )
            })}
          </ol>
        )}
      </ReviewSection>

      {/* Settlement terms */}
      <ReviewSection title="Settlement Terms" step={3} goTo={goTo}>
        <div className="grid gap-3 sm:grid-cols-2">
          <ReviewItem label="Expected Receipts" value={formatCurrency(d.expectedReceipts)} />
          <ReviewItem label="Expected Payments" value={formatCurrency(d.expectedPayments)} />
          <ReviewItem label="Costs" value={formatCurrency(d.costs)} />
          <ReviewItem label={`Share (${state.sharePct}%)`} value={formatCurrency(d.retainedShare)} />
        </div>
        <div className="mt-2 flex items-center justify-between border-t border-border pt-2">
          <span className="text-sm font-medium text-foreground">Expected Profit</span>
          <span className={"font-mono text-sm font-bold " + (d.expectedProfit >= 0 ? "text-success" : "text-danger")}>
            {formatCurrency(d.expectedProfit)}
          </span>
        </div>
      </ReviewSection>

      {/* Logistics */}
      <ReviewSection title="Logistics" step={4} goTo={goTo}>
        <ReviewItem label="Shipment legs" value={`${state.logistics.length}`} />
      </ReviewSection>
    </div>
  )
}

function ReviewSection({
  title,
  step,
  goTo,
  children,
}: {
  title: string
  step: number
  goTo?: (step: number) => void
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {goTo && (
          <button
            type="button"
            onClick={() => goTo(step)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-accent/40 hover:text-accent"
          >
            <Pencil className="size-3.5" />
            Edit
          </button>
        )}
      </div>
      {children}
    </div>
  )
}

function ReviewItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-secondary/30 px-3 py-2.5">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-foreground">{value}</p>
    </div>
  )
}

function ReviewText({ label, value }: { label: string; value: string }) {
  return (
    <div className="mt-3">
      <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="whitespace-pre-line rounded-lg border border-border bg-secondary/30 px-3 py-2 text-sm leading-relaxed text-foreground text-pretty">
        {value || "—"}
      </p>
    </div>
  )
}
