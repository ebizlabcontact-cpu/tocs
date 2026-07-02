"use client"

import { useState } from "react"
import { ArrowRight, ChevronRight } from "lucide-react"
import type { Formula, VersionEntry } from "@/lib/types"
import { getVersionHistory } from "@/lib/mock-data"
import { formatDate } from "@/lib/utils"
import { cn } from "@/lib/utils"
import { StatusBadge } from "@/components/ui/badge"
import { SidePanel } from "@/components/ui/side-panel"

export function VersionsPanel({ formula }: { formula: Formula }) {
  const versions = getVersionHistory(formula)
  const [active, setActive] = useState<VersionEntry | null>(null)

  return (
    <>
      <div className="space-y-3">
        {versions.map((v, i) => (
          <button
            key={v.versionNo}
            type="button"
            onClick={() => setActive(v)}
            className={cn(
              "flex w-full items-center gap-4 rounded-lg border bg-card p-4 text-left transition-colors hover:bg-muted/40",
              i === 0 ? "border-accent/40" : "border-border",
            )}
          >
            <div
              className={cn(
                "flex size-10 shrink-0 items-center justify-center rounded-lg font-mono text-sm font-semibold",
                i === 0 ? "bg-accent-soft text-accent" : "bg-secondary text-muted-foreground",
              )}
            >
              v{v.versionNo}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-semibold text-foreground">{v.summary}</p>
                {i === 0 && <StatusBadge tone="success">Current</StatusBadge>}
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {formatDate(v.createdAt)} · {v.createdBy}
              </p>
            </div>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
          </button>
        ))}
      </div>

      <SidePanel
        open={active !== null}
        onClose={() => setActive(null)}
        title={active ? `Version v${active.versionNo}` : ""}
        description={active?.summary}
      >
        {active && (
          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-card px-4">
              <div className="flex items-center justify-between gap-3 border-b border-border py-2.5">
                <span className="text-xs uppercase tracking-wide text-muted-foreground">Version</span>
                <span className="font-mono text-sm font-medium text-foreground">v{active.versionNo}</span>
              </div>
              <div className="flex items-center justify-between gap-3 border-b border-border py-2.5">
                <span className="text-xs uppercase tracking-wide text-muted-foreground">Created At</span>
                <span className="text-sm font-medium text-foreground">
                  {formatDate(active.createdAt, { month: "short", day: "numeric", year: "numeric" })}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 py-2.5">
                <span className="text-xs uppercase tracking-wide text-muted-foreground">Created By</span>
                <span className="text-sm font-medium text-foreground">{active.createdBy}</span>
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Change Summary
              </p>
              <div className="space-y-2">
                {active.changes.map((c, idx) => (
                  <div key={idx} className="rounded-lg border border-border bg-card p-3">
                    <p className="text-sm font-medium text-foreground">{c.label}</p>
                    {c.from !== undefined && c.to !== undefined ? (
                      <div className="mt-1.5 flex items-center gap-2 font-mono text-sm">
                        <span className="rounded bg-danger-soft px-1.5 py-0.5 text-danger">{c.from}</span>
                        <ArrowRight className="size-3.5 text-muted-foreground" />
                        <span className="rounded bg-success/12 px-1.5 py-0.5 text-success">{c.to}</span>
                      </div>
                    ) : (
                      <p className="mt-1 text-sm text-muted-foreground">{c.note}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Version history is illustrative mock data for demonstration.
            </p>
          </div>
        )}
      </SidePanel>
    </>
  )
}
