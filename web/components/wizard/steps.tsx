"use client"

import { Fragment } from "react"
import { Plus, Trash2, ArrowDown, Link2, Pencil, Flag, FlagOff } from "lucide-react"
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
  type WizardState,
} from "./types"

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

/* Step 2 — Participant Chain (formula-specific roles, no fixed Buyer/Seller) */
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

export function StepParticipants({ state, set }: { state: WizardState; set: Setter }) {
  const update = (id: string, patch: Partial<WizardState["participants"][number]>) =>
    set((s) => ({
      ...s,
      participants: s.participants.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    }))

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Build the trade chain top-to-bottom. Each company&apos;s role, nature, and payment terms are specific to
        this formula. Supports up to 5 companies.
      </p>

      <div className="rounded-xl border border-border bg-secondary/30 p-4">
        <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <Link2 className="size-3.5 text-accent" />
          Trade Chain
        </div>

        <div className="flex flex-col">
          {state.participants.map((p, i) => (
            <Fragment key={p.id}>
              {i > 0 && <ChainConnector />}
              <div className="rounded-lg border border-border bg-card p-3">
                {/* Row 1: sequence + company + remove */}
                <div className="flex items-center gap-2">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent-soft font-mono text-xs font-semibold text-accent">
                    {i + 1}
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
                      Nature Group
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
                      Payment Group
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

                {/* Row 3: start / end point toggles */}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Chain endpoints
                  </span>
                  <ToggleChip
                    active={p.startPoint}
                    onClick={() => update(p.id, { startPoint: !p.startPoint })}
                    icon={Flag}
                  >
                    Start point
                  </ToggleChip>
                  <ToggleChip
                    active={p.endPoint}
                    onClick={() => update(p.id, { endPoint: !p.endPoint })}
                    icon={FlagOff}
                  >
                    End point
                  </ToggleChip>
                </div>
              </div>
            </Fragment>
          ))}
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
                  startPoint: false,
                  endPoint: false,
                  sharePct: 0,
                },
              ],
            }))
          }
        >
          <Plus className="size-4" />
          {state.participants.length >= 5 ? "Maximum 5 companies" : "Add to chain"}
        </Button>
      </div>
    </div>
  )
}

/* Step 3 — Pricing (per-company line: buy/sell/qty/direct cost + profit preview) */
export function StepPricing({ state, set }: { state: WizardState; set: Setter }) {
  const totals = state.lines.reduce(
    (acc, l) => {
      acc.buy += (l.buyUnitPrice || 0) * (l.quantity || 0)
      acc.sell += (l.sellUnitPrice || 0) * (l.quantity || 0)
      acc.cost += l.directCost || 0
      return acc
    },
    { buy: 0, sell: 0, cost: 0 },
  )
  const sharedCost = state.costs.reduce((s, c) => s + (c.amount || 0), 0)
  const optionalShare = ((totals.sell - totals.buy - totals.cost - sharedCost) * (100 - state.sharePct)) / 100
  const expectedProfit = totals.sell - totals.buy - totals.cost - sharedCost - Math.max(0, optionalShare)

  const update = (id: string, patch: Partial<WizardState["lines"][number]>) =>
    set((s) => ({ ...s, lines: s.lines.map((l) => (l.id === id ? { ...l, ...patch } : l)) }))

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Label>Pricing Lines</Label>
        <p className="text-xs text-muted-foreground">
          Each line ties buy/sell unit prices to a company in the trade chain.
        </p>
        {state.lines.map((l, i) => {
          const totalBuy = (l.buyUnitPrice || 0) * (l.quantity || 0)
          const totalSell = (l.sellUnitPrice || 0) * (l.quantity || 0)
          const lineProfit = totalSell - totalBuy - (l.directCost || 0)
          return (
            <div key={l.id} className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center gap-2">
                <CompanySelect
                  className="min-w-0 flex-1"
                  value={l.company}
                  onChange={(v) => update(l.id, { company: v })}
                  placeholderLabel={`Company for line ${i + 1}…`}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  type="button"
                  className="shrink-0"
                  disabled={state.lines.length === 1}
                  onClick={() => set((s) => ({ ...s, lines: s.lines.filter((x) => x.id !== l.id) }))}
                  aria-label="Remove line"
                >
                  <Trash2 className="size-4 text-muted-foreground" />
                </Button>
              </div>

              <Input
                className="mt-2"
                value={l.description}
                placeholder={`Line ${i + 1} description (optional)`}
                onChange={(e) => update(l.id, { description: e.target.value })}
              />

              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <NumField
                  label="Buy Unit Price"
                  value={l.buyUnitPrice}
                  onChange={(v) => update(l.id, { buyUnitPrice: v })}
                />
                <NumField
                  label="Sell Unit Price"
                  value={l.sellUnitPrice}
                  onChange={(v) => update(l.id, { sellUnitPrice: v })}
                />
                <NumField label="Quantity" value={l.quantity} onChange={(v) => update(l.id, { quantity: v })} />
                <NumField
                  label="Direct Cost"
                  value={l.directCost}
                  onChange={(v) => update(l.id, { directCost: v })}
                />
              </div>

              {/* Computed line summary */}
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-secondary/50 px-3 py-2 text-xs">
                <span className="text-muted-foreground">
                  Total buy <span className="font-mono font-medium text-foreground">{formatCurrency(totalBuy)}</span>
                </span>
                <span className="text-muted-foreground">
                  Total sell{" "}
                  <span className="font-mono font-medium text-foreground">{formatCurrency(totalSell)}</span>
                </span>
                <span className="text-muted-foreground">
                  Line profit{" "}
                  <span
                    className={"font-mono font-semibold " + (lineProfit >= 0 ? "text-success" : "text-danger")}
                  >
                    {formatCurrency(lineProfit)}
                  </span>
                </span>
              </div>
            </div>
          )
        })}
        <Button
          variant="subtle"
          type="button"
          onClick={() =>
            set((s) => ({
              ...s,
              lines: [
                ...s.lines,
                {
                  id: uid(),
                  company: "",
                  description: "",
                  buyUnitPrice: 0,
                  sellUnitPrice: 0,
                  quantity: 0,
                  directCost: 0,
                },
              ],
            }))
          }
        >
          <Plus className="size-4" />
          Add line
        </Button>
      </div>

      {/* Shared costs */}
      <div className="space-y-3">
        <Label>Shared Costs (optional)</Label>
        {state.costs.map((c) => (
          <div key={c.id} className="grid gap-3 rounded-lg border border-border bg-card p-4 sm:grid-cols-[1fr_auto_auto]">
            <Input
              value={c.label}
              placeholder="Cost label (e.g. Insurance)"
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

      {/* Expected profit preview */}
      <div className="rounded-xl border border-border bg-secondary/40 p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Expected Net Profit (estimate)</p>
            <p
              className={
                "mt-1 font-mono text-2xl font-bold tabular-nums " +
                (expectedProfit >= 0 ? "text-success" : "text-danger")
              }
            >
              {formatCurrency(expectedProfit)}
            </p>
          </div>
          <div className="text-right text-xs text-muted-foreground">
            <p>
              Total sell <span className="font-mono text-foreground">{formatCurrency(totals.sell)}</span>
            </p>
            <p>
              Total buy <span className="font-mono text-foreground">{formatCurrency(totals.buy)}</span> · Direct cost{" "}
              <span className="font-mono text-foreground">{formatCurrency(totals.cost)}</span>
            </p>
            <p>
              Shared cost <span className="font-mono text-foreground">{formatCurrency(sharedCost)}</span> · Optional
              share <span className="font-mono text-foreground">{formatCurrency(Math.max(0, optionalShare))}</span>
            </p>
          </div>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Net profit = Total sell − Total buy − Direct cost − Optional share.
        </p>
      </div>

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
    </div>
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

/* Step 4 — Payment Schedule (planned only — no actual payment records) */
export function StepSchedule({ state, set }: { state: WizardState; set: Setter }) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Plan expected receipts and payments. Actual receipts and payments are recorded after the formula is created —
        nothing here creates a real payment record.
      </p>
      {state.schedule.length === 0 && (
        <div className="rounded-lg border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
          No scheduled cashflows yet. Add expected receipts and payments.
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
        Add planned cashflow
      </Button>
    </div>
  )
}

/* Step 5 — Logistics */
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

/* Step 6 — Review */
export function StepReview({
  state,
  goTo,
}: {
  state: WizardState
  set: Setter
  goTo?: (step: number) => void
}) {
  const company = companies.find((c) => c.id === state.companyId)
  const totals = state.lines.reduce(
    (acc, l) => {
      acc.buy += (l.buyUnitPrice || 0) * (l.quantity || 0)
      acc.sell += (l.sellUnitPrice || 0) * (l.quantity || 0)
      acc.cost += l.directCost || 0
      return acc
    },
    { buy: 0, sell: 0, cost: 0 },
  )
  const sharedCost = state.costs.reduce((s, c) => s + (c.amount || 0), 0)
  const optionalShare = ((totals.sell - totals.buy - totals.cost - sharedCost) * (100 - state.sharePct)) / 100
  const expectedProfit = totals.sell - totals.buy - totals.cost - sharedCost - Math.max(0, optionalShare)

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

      {/* Participant chain */}
      <ReviewSection title="Participant Chain" step={2} goTo={goTo}>
        {state.participants.length === 0 ? (
          <p className="text-sm text-muted-foreground">No participants added.</p>
        ) : (
          <ol className="space-y-1.5">
            {state.participants.map((p, i) => {
              const role = roleGroupOptions.find((o) => o.value === p.roleGroup)?.label ?? p.roleGroup
              return (
                <li key={p.id} className="flex items-center gap-2 text-sm">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent-soft font-mono text-[11px] font-semibold text-accent">
                    {i + 1}
                  </span>
                  <span className="font-medium text-foreground">{p.company || "—"}</span>
                  <span className="text-muted-foreground">· {role}</span>
                  {p.startPoint && <span className="text-[11px] font-medium text-accent">Start</span>}
                  {p.endPoint && <span className="text-[11px] font-medium text-accent">End</span>}
                </li>
              )
            })}
          </ol>
        )}
      </ReviewSection>

      {/* Pricing */}
      <ReviewSection title="Pricing" step={3} goTo={goTo}>
        <div className="space-y-1.5">
          {state.lines.map((l, i) => {
            const totalSell = (l.sellUnitPrice || 0) * (l.quantity || 0)
            const totalBuy = (l.buyUnitPrice || 0) * (l.quantity || 0)
            return (
              <div key={l.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="min-w-0 truncate text-muted-foreground">
                  {l.company || `Line ${i + 1}`}
                </span>
                <span className="shrink-0 font-mono text-xs text-muted-foreground">
                  Buy {formatCurrency(totalBuy)} · Sell {formatCurrency(totalSell)}
                </span>
              </div>
            )
          })}
        </div>
        <div className="mt-2 flex items-center justify-between border-t border-border pt-2">
          <span className="text-sm font-medium text-foreground">Expected Net Profit</span>
          <span
            className={"font-mono text-sm font-bold " + (expectedProfit >= 0 ? "text-success" : "text-danger")}
          >
            {formatCurrency(expectedProfit)}
          </span>
        </div>
      </ReviewSection>

      {/* Payment schedule */}
      <ReviewSection title="Payment Schedule" step={4} goTo={goTo}>
        <ReviewItem label="Planned cashflows" value={`${state.schedule.length}`} />
      </ReviewSection>

      {/* Logistics */}
      <ReviewSection title="Logistics" step={5} goTo={goTo}>
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
