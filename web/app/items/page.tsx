import { PageHeader } from "@/components/page-header"
import { ItemsExplorer } from "@/components/items/items-explorer"

export default function ItemsPage() {
  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Items"
        description="Registered item master data. Selecting an item in a formula pulls in its default unit and spec / quality memo."
      />
      <ItemsExplorer />
    </div>
  )
}
