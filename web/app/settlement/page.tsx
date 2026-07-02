import { Scale } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { ComingSoon } from "@/components/coming-soon"

export default function SettlementPage() {
  return (
    <>
      <PageHeader title="Settlement" description="Close formulas and reconcile realized profit." />
      <ComingSoon
        icon={Scale}
        title="Settlement workspace"
        description="Review closeable formulas and finalize realized profit. Settlement logic is handled by the backend."
      />
    </>
  )
}
