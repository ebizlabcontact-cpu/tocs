import { Building2 } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { CompaniesExplorer } from "@/components/companies/companies-explorer"

export default function CompaniesPage() {
  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Companies"
        description="Registered trade companies — the counterparties selectable as participants in a formula. Create, edit, archive, or remove them."
      />

      <CompaniesExplorer />

      <div className="mt-6 flex items-center gap-2 rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
        <Building2 className="size-4 shrink-0 text-accent" />
        Switching your operating entity (your own books of business) is handled by the company switcher in the header.
      </div>
    </div>
  )
}
