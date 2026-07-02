"use client"

import { Fragment } from "react"
import { ArrowDown, Plus, Trash2, Link2 } from "lucide-react"
import { Input, Select } from "@/components/ui/field"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export type ChainNode = {
  id: string
  name: string
  role: string
  sharePct?: number
}

const roleLabels: Record<string, string> = {
  buyer: "Buyer",
  seller: "Seller",
  agent: "Agent",
  logistics: "Logistics",
  financier: "Financier",
}

function Connector() {
  return (
    <div className="flex justify-center py-1" aria-hidden>
      <ArrowDown className="size-4 text-muted-foreground/60" />
    </div>
  )
}

/**
 * Visual participant / trade chain: Company A → B → C ...
 * Renders read-only by default, or an editable chain with dynamic add/remove.
 * Purely presentational — no calculations, no backend.
 */
export function ParticipantChain({
  nodes,
  editable = false,
  roleOptions = [],
  showShare = false,
  onChange,
  onRemove,
  onAdd,
  minNodes = 1,
}: {
  nodes: ChainNode[]
  editable?: boolean
  roleOptions?: readonly string[]
  showShare?: boolean
  onChange?: (id: string, patch: Partial<ChainNode>) => void
  onRemove?: (id: string) => void
  onAdd?: () => void
  minNodes?: number
}) {
  if (nodes.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
        No participants in the chain yet.
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border bg-secondary/30 p-4">
      <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Link2 className="size-3.5 text-accent" />
        Trade Chain
      </div>

      <div className="flex flex-col">
        {nodes.map((node, i) => (
          <Fragment key={node.id}>
            {i > 0 && <Connector />}
            {editable ? (
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-3 sm:flex-nowrap">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent-soft font-mono text-xs font-semibold text-accent">
                  {i + 1}
                </div>
                <Input
                  className="min-w-0 flex-1"
                  value={node.name}
                  placeholder={`Company ${String.fromCharCode(65 + i)}`}
                  onChange={(e) => onChange?.(node.id, { name: e.target.value })}
                />
                <Select
                  className="w-32 shrink-0"
                  value={node.role}
                  onChange={(e) => onChange?.(node.id, { role: e.target.value })}
                >
                  {(roleOptions.length ? roleOptions : Object.keys(roleLabels)).map((r) => (
                    <option key={r} value={r}>
                      {roleLabels[r] ?? r}
                    </option>
                  ))}
                </Select>
                {showShare ? (
                  <div className="relative w-20 shrink-0">
                    <Input
                      type="number"
                      className="pr-6"
                      value={node.sharePct ?? 0}
                      aria-label="Share percent"
                      onChange={(e) => onChange?.(node.id, { sharePct: Number(e.target.value) })}
                    />
                    <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                      %
                    </span>
                  </div>
                ) : null}
                <Button
                  variant="ghost"
                  size="icon"
                  type="button"
                  className="shrink-0"
                  disabled={nodes.length <= minNodes}
                  onClick={() => onRemove?.(node.id)}
                  aria-label={`Remove ${node.name || `company ${i + 1}`}`}
                >
                  <Trash2 className="size-4 text-muted-foreground" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-sm font-semibold text-accent">
                  {node.name ? node.name.slice(0, 2).toUpperCase() : String.fromCharCode(65 + i)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {node.name || `Company ${String.fromCharCode(65 + i)}`}
                  </p>
                  <p className="truncate text-xs capitalize text-muted-foreground">
                    {roleLabels[node.role] ?? node.role}
                  </p>
                </div>
                {showShare && node.sharePct !== undefined && (
                  <span className="font-mono text-xs text-muted-foreground">{node.sharePct}%</span>
                )}
              </div>
            )}
          </Fragment>
        ))}
      </div>

      {editable && onAdd && (
        <Button variant="subtle" type="button" className="mt-3 w-full" onClick={onAdd}>
          <Plus className="size-4" />
          Add to chain
        </Button>
      )}
    </div>
  )
}
