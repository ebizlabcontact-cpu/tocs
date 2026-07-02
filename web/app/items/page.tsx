import { PageHeader } from "@/components/page-header"
import { ItemsExplorer } from "@/components/items/items-explorer"

export default function ItemsPage() {
  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Items"
        description="Tradable commodities and their specification templates. Selecting an item in a formula pulls in these fields."
      />
      <ItemsExplorer />
    </div>
  )
}
