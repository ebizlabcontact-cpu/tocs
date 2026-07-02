import { ArrowLeftRight } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { ComingSoon } from "@/components/coming-soon"

export default function PaymentsPage() {
  return (
    <>
      <PageHeader title="Payments" description="Receipt and payment schedules across your formulas." />
      <ComingSoon
        icon={ArrowLeftRight}
        title="Payments workspace"
        description="Track upcoming receipts and payments, record settlements, and reconcile against each formula's schedule."
      />
    </>
  )
}
