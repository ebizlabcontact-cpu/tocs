import { ReceiptText } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { ComingSoon } from "@/components/coming-soon"

export default function InvoicesPage() {
  return (
    <>
      <PageHeader title="Invoices" description="Issued and received invoices, matched to formulas." />
      <ComingSoon
        icon={ReceiptText}
        title="Invoices workspace"
        description="Match issued and received invoices to formulas and surface unmatched documents that need reconciliation."
      />
    </>
  )
}
