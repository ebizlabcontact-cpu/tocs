import Link from "next/link"
import { getFormula } from "@/lib/mock-data"
import { FormulaDetailView } from "@/components/formulas/formula-detail-view"
import { buttonVariants } from "@/components/ui/button"

export default async function FormulaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const formula = getFormula(id)

  if (!formula) {
    return (
      <div className="animate-fade-in py-20 text-center">
        <h1 className="text-lg font-semibold text-foreground">Formula not found</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          This formula may have been closed or does not exist.
        </p>
        <Link href="/formulas" className={buttonVariants({ variant: "accent", className: "mt-4" })}>
          Back to Formulas
        </Link>
      </div>
    )
  }

  return <FormulaDetailView formula={formula} />
}
