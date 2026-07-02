import { PageHeader } from "@/components/page-header"
import { ReportsWorkspace } from "@/components/reports/reports-workspace"

export default function ReportsPage() {
  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Reports"
        description="Profit, cashflow, and operational analytics — projected entirely from formulas."
      />
      <ReportsWorkspace />
    </div>
  )
}
