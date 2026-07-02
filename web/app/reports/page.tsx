import { BarChart3 } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { ComingSoon } from "@/components/coming-soon"

export default function ReportsPage() {
  return (
    <>
      <PageHeader title="Reports" description="Profit, cashflow, and operational analytics." />
      <ComingSoon
        icon={BarChart3}
        title="Reports workspace"
        description="Generate realized profit, receivable aging, and cashflow reports scoped to the selected company."
      />
    </>
  )
}
