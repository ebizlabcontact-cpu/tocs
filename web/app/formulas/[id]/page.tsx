import Link from "next/link"
import { getFormula } from "@/lib/mock-data"
import { getPreviewFormula } from "@/lib/formula-preview-session"
import { FormulaDetailShell } from "@/components/formulas/formula-detail-shell"
import { buttonVariants } from "@/components/ui/button"

export default async function FormulaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const formula = getPreviewFormula(id) ?? getFormula(id)

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

  return <FormulaDetailShell initialFormula={formula} />
}
