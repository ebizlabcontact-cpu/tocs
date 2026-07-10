"use client"

import { type ReactNode, useMemo, useState } from "react"
import { GitCommitVertical, GitBranch, Pencil, ChevronDown } from "lucide-react"
import type { Formula, Participant, VersionChange } from "@/lib/types"
import { chainOrderOf, deriveLogisticsCost } from "@/lib/formula-math"
import {
  patchFormulaFxPreview,
  patchLogisticsCostPreview,
  patchParticipantEconomicsPreview,
} from "@/lib/formula-preview-mutations"
import { useFormulaWorkflow } from "./workflows/formula-workflow-context"
import { MockPreviewNote } from "./workflows/mock-preview-note"
import { VersionTriggerModal } from "./workflows/workflow-modals"
import { FormulaEditSimulation } from "./formula-edit-simulation"
import { formatCurrency, formatNumber, cn } from "@/lib/utils"
import { Field, Input } from "@/components/ui/field"
import { Button } from "@/components/ui/button"
import { Modal } from "@/components/ui/modal"

/**
 * Version Trigger UI Expansion (P1 Feature 3). Exposes all Formula-detail
 * version-triggering fields per TOCS version policy: formula quantity + sell
 * price (existing simulation), exchange rates, logistics cost, and per-hop
 * participant unit economics. Every edit routes through VersionTriggerModal
 * before applying a preview mutation. Hidden entirely when the user cannot
 * commit a version (also covers closed / canceled formulas).
 */
export function VersionTriggerFieldsPanel({
  formula,
  hidePreviewNote = false,
  chrome = true,
}: {
  formula: Formula
  /** P1-3: parent (VersionsTabLayout) renders a single MockPreviewNote instead. */
  hidePreviewNote?: boolean
  /** P1-3: when false, drop the outer card/title (rendered inside a CollapsibleSection). */
  chrome?: boolean
}) {
  const { caps } = useFormulaWorkflow()
  if (!caps.canCommitVersion) return null

  const isCrossBorder = formula.transactionCurrency !== formula.baseCurrency

  const body = (
    <>
      {!hidePreviewNote && (
        <div className="mb-4">
          <MockPreviewNote />
        </div>
      )}

      <div className="space-y-3">
        {/* A — Formula Quantity & Sell Price */}
        <NestedDisclosure title="Simulation — Quantity & Sell Price" defaultOpen>
          <FormulaEditSimulation formula={formula} hidePreviewNote />
        </NestedDisclosure>

        {/* B — Exchange Rates (cross-border only) */}
        {isCrossBorder && (
          <NestedDisclosure title="Exchange Rates">
            <FxVersionTriggerSection formula={formula} />
          </NestedDisclosure>
        )}

        {/* C — Logistics Cost */}
        <NestedDisclosure title="Logistics Cost Rollup">
          <LogisticsCostVersionTriggerSection formula={formula} />
        </NestedDisclosure>

        {/* D — Participant Unit Economics */}
        <NestedDisclosure title="Participant Unit Economics">
          <ParticipantEconomicsVersionTriggerSection formula={formula} />
        </NestedDisclosure>
      </div>
    </>
  )

  if (!chrome) return body

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-1 flex items-center gap-2">
        <GitCommitVertical className="size-4 text-accent" />
        <h3 className="text-sm font-semibold text-foreground">Version-Triggering Fields</h3>
      </div>
      <p className="mb-4 text-xs leading-relaxed text-muted-foreground">
        Changes here create formula_versions + calculation_snapshots + audit_logs on the backend.
      </p>
      {body}
    </div>
  )
}

/** P1-3 simple nested disclosure (not a full CollapsibleSection). */
function NestedDisclosure({
  title,
  defaultOpen = false,
  children,
}: {
  title: string
  defaultOpen?: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 bg-secondary/40 px-3 py-2.5 text-left"
      >
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</span>
        <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && <div className="p-3">{children}</div>}
    </div>
  )
}

function TriggerBanner({ fields }: { fields: string[] }) {
  if (fields.length === 0) return null
  return (
    <div className="mt-3 flex items-start gap-2 rounded-lg border border-accent/40 bg-accent-soft px-3 py-2.5 text-xs leading-relaxed text-accent">
      <GitBranch className="mt-0.5 size-4 shrink-0" />
      <span>
        This change would create a new Version + Snapshot after backend integration.
        <span className="text-muted-foreground"> Version-triggering fields edited: {fields.join(", ")}.</span>
      </span>
    </div>
  )
}

/* ---------------- Exchange Rates ---------------- */

function FxVersionTriggerSection({ formula }: { formula: Formula }) {
  const { applyPreview, appendVersion } = useFormulaWorkflow()
  const baseContract = formula.contractExchangeRate ?? 0
  const baseAdjusted = formula.adjustedExchangeRate ?? 0
  const [contract, setContract] = useState(String(baseContract || ""))
  const [adjusted, setAdjusted] = useState(String(baseAdjusted || ""))
  const [open, setOpen] = useState(false)

  const contractNum = Number(contract)
  const adjustedNum = Number(adjusted)
  const contractChanged = contractNum !== baseContract
  const adjustedChanged = adjustedNum !== baseAdjusted
  const dirty = contractChanged || adjustedChanged
  const valid = contractNum > 0 && adjustedNum > 0

  const triggered = [
    contractChanged && "Contract Exchange Rate",
    adjustedChanged && "Adjusted Exchange Rate",
  ].filter(Boolean) as string[]

  function confirm() {
    const summary = `Exchange rate updated (contract ${formatNumber(baseContract)} → ${formatNumber(contractNum)}, adjusted ${formatNumber(baseAdjusted)} → ${formatNumber(adjustedNum)})`
    const changes: VersionChange[] = []
    if (contractChanged)
      changes.push({ field: "contractExchangeRate", label: "Contract Exchange Rate", oldValue: baseContract, newValue: contractNum, valueType: "number", versionTriggering: true })
    if (adjustedChanged)
      changes.push({ field: "adjustedExchangeRate", label: "Adjusted Exchange Rate", oldValue: baseAdjusted, newValue: adjustedNum, valueType: "number", versionTriggering: true })
    appendVersion({ versionNo: formula.latestVersionNo + 1, createdAt: new Date().toISOString(), createdBy: "Preview User", summary, changes })
    applyPreview((f) => patchFormulaFxPreview(f, { contractExchangeRate: contractNum, adjustedExchangeRate: adjustedNum }, summary))
    setOpen(false)
  }

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Contract Exchange Rate">
          <Input type="number" step="0.01" value={contract} onChange={(e) => setContract(e.target.value)} />
        </Field>
        <Field label="Adjusted Exchange Rate">
          <Input type="number" step="0.01" value={adjusted} onChange={(e) => setAdjusted(e.target.value)} />
        </Field>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Base: {formula.baseCurrency} · Transaction: {formula.transactionCurrency}
      </p>
      <TriggerBanner fields={triggered} />
      <div className="mt-3 flex justify-end">
        <Button variant="outline" type="button" disabled={!dirty || !valid} onClick={() => setOpen(true)}>
          <GitCommitVertical className="size-4" />
          Apply FX Change (Preview)
        </Button>
      </div>
      <VersionTriggerModal open={open} onClose={() => setOpen(false)} onConfirm={confirm} actionLabel="Apply FX Change" />
    </>
  )
}

/* ---------------- Logistics Cost ---------------- */

function LogisticsCostVersionTriggerSection({ formula }: { formula: Formula }) {
  const { applyPreview, appendVersion } = useFormulaWorkflow()
  const baseCost = deriveLogisticsCost(formula)
  const [cost, setCost] = useState(String(baseCost || ""))
  const [open, setOpen] = useState(false)

  const costNum = Number(cost)
  const dirty = costNum !== baseCost
  const valid = costNum >= 0
  const triggered = dirty ? ["Logistics Cost"] : []

  function confirm() {
    const summary = `Logistics cost updated ${formatCurrency(baseCost)} → ${formatCurrency(costNum)}`
    appendVersion({
      versionNo: formula.latestVersionNo + 1,
      createdAt: new Date().toISOString(),
      createdBy: "Preview User",
      summary,
      changes: [{ field: "totalLogisticsCost", label: "Total Logistics Cost", oldValue: baseCost, newValue: costNum, valueType: "currency", versionTriggering: true }],
    })
    applyPreview((f) => patchLogisticsCostPreview(f, costNum, summary))
    setOpen(false)
  }

  return (
    <>
      <Field label="Total Logistics Cost (KRW)">
        <Input type="number" min={0} value={cost} onChange={(e) => setCost(e.target.value)} />
      </Field>
      <p className="mt-1 text-xs text-muted-foreground">
        Rollup of logistics legs; version-triggering per TOCS policy.
      </p>
      <TriggerBanner fields={triggered} />
      <div className="mt-3 flex justify-end">
        <Button variant="outline" type="button" disabled={!dirty || !valid} onClick={() => setOpen(true)}>
          <GitCommitVertical className="size-4" />
          Apply Logistics Cost (Preview)
        </Button>
      </div>
      <VersionTriggerModal open={open} onClose={() => setOpen(false)} onConfirm={confirm} actionLabel="Apply Logistics Cost" />
    </>
  )
}

/* ---------------- Participant Unit Economics ---------------- */

function ParticipantEconomicsVersionTriggerSection({ formula }: { formula: Formula }) {
  const chain = useMemo(
    () => [...formula.participants].sort((a, b) => chainOrderOf(a) - chainOrderOf(b)),
    [formula.participants],
  )
  const [editing, setEditing] = useState<Participant | null>(null)

  return (
    <>
      {chain.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
          No participants to edit.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[640px] text-sm">
            <caption className="sr-only">Participant unit economics (version-triggering)</caption>
            <thead className="bg-secondary/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th scope="col" className="px-3 py-2.5 text-center font-medium">Seq</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Company</th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">Quantity</th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">Buy Unit</th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">Sell Unit</th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {chain.map((p) => {
                const buy = p.buyUnitPrice ?? p.buyPrice
                const sell = p.sellUnitPrice ?? p.sellPrice
                return (
                  <tr key={p.id} className="bg-card">
                    <td className="px-3 py-3 text-center">
                      <span className="inline-flex size-6 items-center justify-center rounded-md bg-secondary font-mono text-xs font-semibold text-muted-foreground">
                        {chainOrderOf(p) + 1}
                      </span>
                    </td>
                    <td className="px-3 py-3 font-medium text-foreground">{p.company}</td>
                    <td className="px-3 py-3 text-right font-mono tabular-nums text-foreground">
                      {p.quantity != null ? formatNumber(p.quantity) : "—"}
                    </td>
                    <td className="px-3 py-3 text-right font-mono tabular-nums text-foreground">
                      {buy ? formatCurrency(buy) : "—"}
                    </td>
                    <td className="px-3 py-3 text-right font-mono tabular-nums text-foreground">
                      {sell ? formatCurrency(sell) : "—"}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <Button variant="outline" size="sm" onClick={() => setEditing(p)}>
                        <Pencil className="size-3.5" />
                        Edit economics
                      </Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <ParticipantEconomicsEditModal
          formula={formula}
          participant={editing}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  )
}

function ParticipantEconomicsEditModal({
  formula,
  participant,
  onClose,
}: {
  formula: Formula
  participant: Participant
  onClose: () => void
}) {
  const { applyPreview, appendVersion } = useFormulaWorkflow()
  const baseQty = participant.quantity ?? 0
  const baseBuy = participant.buyUnitPrice ?? participant.buyPrice ?? 0
  const baseSell = participant.sellUnitPrice ?? participant.sellPrice ?? 0
  const [quantity, setQuantity] = useState(String(baseQty || ""))
  const [buyUnitPrice, setBuyUnitPrice] = useState(String(baseBuy || ""))
  const [sellUnitPrice, setSellUnitPrice] = useState(String(baseSell || ""))
  const [versionOpen, setVersionOpen] = useState(false)

  const qtyNum = Number(quantity)
  const buyNum = Number(buyUnitPrice)
  const sellNum = Number(sellUnitPrice)
  const valid = qtyNum >= 1

  function confirm() {
    const summary = `Participant economics updated: ${participant.company}`
    const changes: VersionChange[] = []
    if (qtyNum !== baseQty)
      changes.push({ field: "quantity", label: "Participant Quantity", oldValue: baseQty, newValue: qtyNum, valueType: "number", versionTriggering: true })
    if (buyNum !== baseBuy)
      changes.push({ field: "buyUnitPrice", label: "Buy Unit Price", oldValue: baseBuy, newValue: buyNum, valueType: "currency", versionTriggering: true })
    if (sellNum !== baseSell)
      changes.push({ field: "sellUnitPrice", label: "Sell Unit Price", oldValue: baseSell, newValue: sellNum, valueType: "currency", versionTriggering: true })
    appendVersion({ versionNo: formula.latestVersionNo + 1, createdAt: new Date().toISOString(), createdBy: "Preview User", summary, changes })
    applyPreview((f) =>
      patchParticipantEconomicsPreview(f, participant.id, { quantity: qtyNum, buyUnitPrice: buyNum, sellUnitPrice: sellNum }, summary),
    )
    setVersionOpen(false)
    onClose()
  }

  return (
    <>
      <Modal
        open
        onClose={onClose}
        title="Edit Participant Economics"
        description="Version-triggering fields for this participant hop."
        footer={
          <>
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="accent" disabled={!valid} onClick={() => setVersionOpen(true)}>
              Continue
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <MockPreviewNote />
          <Field label="Quantity">
            <Input type="number" min={1} value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          </Field>
          <Field label="Buy Unit Price (KRW)">
            <Input type="number" min={0} value={buyUnitPrice} onChange={(e) => setBuyUnitPrice(e.target.value)} />
          </Field>
          <Field label="Sell Unit Price (KRW)">
            <Input type="number" min={0} value={sellUnitPrice} onChange={(e) => setSellUnitPrice(e.target.value)} />
          </Field>
        </div>
      </Modal>
      <VersionTriggerModal
        open={versionOpen}
        onClose={() => setVersionOpen(false)}
        onConfirm={confirm}
        actionLabel="Save Economics"
      />
    </>
  )
}
