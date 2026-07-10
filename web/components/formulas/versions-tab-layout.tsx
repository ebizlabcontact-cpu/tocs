"use client"

import { type ReactNode, useState } from "react"
import { ChevronDown, History, Camera, GitCommitVertical } from "lucide-react"
import type { Formula, VersionEntry } from "@/lib/types"
import { cn } from "@/lib/utils"
import { StatusBadge } from "@/components/ui/badge"
import { useFormulaWorkflow } from "./workflows/formula-workflow-context"
import { MockPreviewNote } from "./workflows/mock-preview-note"
import { VersionsPanel } from "./versions-panel"
import { VersionTriggerFieldsPanel } from "./version-trigger-fields-panel"

/**
 * P1-3 Versions tab restructure. Groups History, Snapshot helper, and
 * Version-Triggering Edits into three independent collapsible sections to cut
 * scroll fatigue. Layout-only — snapshot SidePanel and every version-commit
 * flow are unchanged.
 */
export function VersionsTabLayout({
  formula,
  versionHistory,
}: {
  formula: Formula
  versionHistory?: VersionEntry[]
}) {
  const { caps } = useFormulaWorkflow()
  const versionCount = Math.max(1, formula.latestVersionNo)
  // Section 3 hidden entirely when the user cannot commit a version (also covers closed/canceled).
  const showEdits = caps.canCommitVersion

  return (
    <div className="space-y-4">
      <CollapsibleSection
        title="Version History"
        description="Chronological list of formula versions."
        defaultOpen
        badge={<StatusBadge tone="outline">{`${versionCount} version${versionCount === 1 ? "" : "s"}`}</StatusBadge>}
        icon={History}
      >
        <VersionsPanel formula={formula} versionHistory={versionHistory} />
      </CollapsibleSection>

      <CollapsibleSection
        title="Snapshot Viewer"
        description="Frozen calculation state at each version. Open any row in History."
        defaultOpen={false}
        icon={Camera}
      >
        <div className="rounded-lg border border-dashed border-border bg-secondary/30 p-4 text-sm leading-relaxed text-muted-foreground">
          Click a version row in <span className="font-medium text-foreground">Version History</span> above to open its
          calculation snapshot in the side panel. Each snapshot is frozen at the moment its version was created and is
          read-only.
        </div>
      </CollapsibleSection>

      {showEdits && (
        <CollapsibleSection
          title="Version-Triggering Edits"
          description="Changes that create a new version and snapshot."
          defaultOpen={false}
          badge={<StatusBadge tone="info">Edits available</StatusBadge>}
          icon={GitCommitVertical}
        >
          {/* Single MockPreviewNote for the whole section (moved out of the panel). */}
          <div className="mb-4">
            <MockPreviewNote />
          </div>
          <VersionTriggerFieldsPanel formula={formula} hidePreviewNote chrome={false} />
        </CollapsibleSection>
      )}
    </div>
  )
}

function CollapsibleSection({
  title,
  description,
  defaultOpen = false,
  badge,
  icon: Icon,
  children,
}: {
  title: string
  description?: string
  defaultOpen?: boolean
  badge?: ReactNode
  icon?: React.ComponentType<{ className?: string }>
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section className="overflow-hidden rounded-lg border border-border bg-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="flex min-w-0 items-center gap-2.5">
          {Icon && <Icon className="size-4 shrink-0 text-accent" />}
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-foreground">{title}</span>
            {description && <span className="block truncate text-xs text-muted-foreground">{description}</span>}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {badge}
          <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", open && "rotate-180")} />
        </span>
      </button>
      {open && <div className="border-t border-border p-4">{children}</div>}
    </section>
  )
}
