"use client"

import { Plus, Trash2 } from "lucide-react"
import { companies } from "@/lib/mock-data"
import { tradeTypeConfig } from "@/lib/status"
import type { TradeType } from "@/lib/types"
import { Field, Input, Select, Label } from "@/components/ui/field"
import { Button } from "@/components/ui/button"
import { ParticipantChain } from "@/components/formulas/participant-chain"
import { formatCurrency, uid } from "@/lib/utils"
import type { WizardParticipant, WizardState } from "./types"

type Setter = (updater: (s: WizardState) => WizardState) => void

/* Step 1 — Basics */
export function StepBasics({ state, set }: { state: WizardState; set: Setter }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Company" className="sm:col-span-2">
        <Select
          value={state.companyId}
          onChange={(e) => set((s) => ({ ...s, companyId: e.target.value }))}
        >
          {companies
            .filter((c) => c.id !== "all")
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
        </Select>
      </Field>
      <Field label="Item / Commodity">
        <Input
          value={state.item}
          onChange={(e) => set((s) => ({ ...s, item: e.target.value }))}
          placeholder="e.g. Copper Cathode"
        />
      </Field>
      <Field label="Reference (optional)">
        <Input
          value={state.reference}
          onChange={(e) => set((s) => ({ ...s, reference: e.target.value }))}
          placeholder="Internal deal code"
        />
      </Field>
      <Field label="Trade Type" className="sm:col-span-2">
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
    </div>
  )
}

/* Step 2 — Participants (visual trade chain) */
const roleOptions = ["buyer", "seller", "agent", "logistics", "financier"] as const

export function StepParticipants({ state, set }: { state: WizardState; set: Setter }) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Order participants top-to-bottom to represent the flow of goods and funds through the deal.
      </p>
      <ParticipantChain
        nodes={state.participants}
        editable
        showShare
        roleOptions={roleOptions}
        minNodes={1}
        onChange={(id, patch) =>
          set((s) => ({
            ...s,
            participants: s.participants.map((x) =>
              x.id === id
                ? {
                    ...x,
                    ...patch,
                    role: (patch.role as WizardParticipant["role"]) ?? x.role,
                  }
                : x,
            ),
          }))
        }
        onRemove={(id) => set((s) => ({ ...s, participants: s.participants.filter((x) => x.id !== id) }))}
        onAdd={() =>
          set((s) => ({
            ...s,
            participants: [...s.participants, { id: uid(), name: "", role: "buyer", sharePct: 0 }],
          }))
        }
      />
    </div>
  )
}

/* Step 3 — Pricing (line items + costs + profit share) */
export function StepPricing({ state, set }: { state: WizardState; set: Setter }) {
  const sell = state.lines.reduce((s, l) => s + (l.sell || 0), 0)
  const buy = state.lines.reduce((s, l) => s + (l.buy || 0), 0)
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Label>Line Items</Label>
      {state.lines.map((l, i) => (
        <div key={l.id} className="grid gap-3 rounded-lg border border-border bg-card p-4 sm:grid-cols-[1fr_auto_auto_auto]">
          <Field label={i === 0 ? "Description" : ""}>
            <Input
              value={l.description}
              placeholder="Line description"
              onChange={(e) =>
                set((s) => ({
                  ...s,
                  lines: s.lines.map((x) => (x.id === l.id ? { ...x, description: e.target.value } : x)),
                }))
              }
            />
          </Field>
          <Field label={i === 0 ? "Sell" : ""}>
            <Input
              type="number"
              value={l.sell || ""}
              className="w-32"
              placeholder="0"
              onChange={(e) =>
                set((s) => ({
                  ...s,
                  lines: s.lines.map((x) => (x.id === l.id ? { ...x, sell: Number(e.target.value) } : x)),
                }))
              }
            />
          </Field>
          <Field label={i === 0 ? "Buy" : ""}>
            <Input
              type="number"
              value={l.buy || ""}
              className="w-32"
              placeholder="0"
              onChange={(e) =>
                set((s) => ({
                  ...s,
                  lines: s.lines.map((x) => (x.id === l.id ? { ...x, buy: Number(e.target.value) } : x)),
                }))
              }
            />
          </Field>
          <div className="flex items-end">
            <Button
              variant="ghost"
              size="icon"
              type="button"
              disabled={state.lines.length === 1}
              onClick={() => set((s) => ({ ...s, lines: s.lines.filter((x) => x.id !== l.id) }))}
              aria-label="Remove line"
            >
              <Trash2 className="size-4 text-muted-foreground" />
            </Button>
          </div>
        </div>
      ))}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          variant="subtle"
          type="button"
          onClick={() => set((s) => ({ ...s, lines: [...s.lines, { id: uid(), description: "", sell: 0, buy: 0 }] }))}
        >
          <Plus className="size-4" />
          Add line
        </Button>
        <p className="text-sm text-muted-foreground">
          Sell <span className="font-mono font-semibold text-foreground">{formatCurrency(sell)}</span> · Buy{" "}
          <span className="font-mono font-semibold text-foreground">{formatCurrency(buy)}</span>
        </p>
      </div>
      </div>

      <div className="space-y-3">
        <Label>Costs</Label>
        {state.costs.map((c) => (
          <div key={c.id} className="grid gap-3 rounded-lg border border-border bg-card p-4 sm:grid-cols-[1fr_auto_auto]">
            <Input
              value={c.label}
              placeholder="Cost label"
              onChange={(e) =>
                set((s) => ({
                  ...s,
                  costs: s.costs.map((x) => (x.id === c.id ? { ...x, label: e.target.value } : x)),
                }))
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

      <Field label={`Profit share — ${state.sharePct}%`} hint="Your entitled portion of the gross margin.">
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

/* Step 4 — Payment Schedule */
export function StepSchedule({ state, set }: { state: WizardState; set: Setter }) {
  return (
    <div className="space-y-3">
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
            <option value="receipt">Receipt</option>
            <option value="payment">Payment</option>
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
            className="w-32"
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
            schedule: [
              ...s.schedule,
              { id: uid(), type: "receipt", counterparty: "", amount: 0, dueDate: "" },
            ],
          }))
        }
      >
        <Plus className="size-4" />
        Add cashflow
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
      {state.logistics.length === 0 && (
        <div className="rounded-lg border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
          No shipment legs yet. Add routing for goods moving through the deal.
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
export function StepReview({ state, set }: { state: WizardState; set: Setter }) {
  const company = companies.find((c) => c.id === state.companyId)
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <ReviewItem label="Company" value={company?.name ?? "—"} />
        <ReviewItem label="Item" value={state.item || "—"} />
        <ReviewItem label="Trade Type" value={tradeTypeConfig[state.tradeType].label} />
        <ReviewItem label="Reference" value={state.reference || "—"} />
        <ReviewItem label="Participants" value={`${state.participants.length}`} />
        <ReviewItem label="Line items" value={`${state.lines.length}`} />
        <ReviewItem label="Costs" value={`${state.costs.length}`} />
        <ReviewItem label="Payment schedule" value={`${state.schedule.length}`} />
        <ReviewItem label="Shipment legs" value={`${state.logistics.length}`} />
        <ReviewItem label="Profit share" value={`${state.sharePct}%`} />
      </div>
      <Field label="Notes (optional)">
        <textarea
          value={state.notes}
          onChange={(e) => set((s) => ({ ...s, notes: e.target.value }))}
          rows={3}
          className="w-full rounded-[var(--radius-md)] border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none focus:ring-2 focus:ring-ring/40"
          placeholder="Add any context for this formula..."
        />
      </Field>
    </div>
  )
}

function ReviewItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2.5">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-foreground">{value}</p>
    </div>
  )
}
