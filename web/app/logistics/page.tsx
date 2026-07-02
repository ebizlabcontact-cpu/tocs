import { Truck } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { ComingSoon } from "@/components/coming-soon"

export default function LogisticsPage() {
  return (
    <>
      <PageHeader title="Logistics" description="Shipment tracking across all trade legs." />
      <ComingSoon
        icon={Truck}
        title="Logistics workspace"
        description="Follow every shipment leg from booking to customs clearance, linked back to its originating formula."
      />
    </>
  )
}
