"use client"

import Link from "next/link"
import { Plus } from "lucide-react"
import { useCompany } from "@/components/company-context"
import { useAuth } from "@/components/auth/auth-provider"
import { roleAtLeast } from "@/lib/permissions"
import { buttonVariants } from "@/components/ui/button"
import { Tooltip } from "@/components/ui/tooltip"
import { t } from "@/lib/i18n"
import { cn } from "@/lib/utils"

export function CreateFormulaButton({ className }: { className?: string }) {
  const { isAllCompanies } = useCompany()
  const { user } = useAuth()
  const canCreate = user ? roleAtLeast(user.role, "MANAGER") : false

  if (isAllCompanies) {
    return (
      <Tooltip content={t("dashboard.createFormula.specificCompanyHint")}>
        <button
          type="button"
          disabled
          aria-disabled="true"
          className={cn(buttonVariants({ variant: "accent" }), "gap-2 opacity-50", className)}
        >
          <Plus className="size-4" />
          {t("dashboard.quickActions.createFormula")}
        </button>
      </Tooltip>
    )
  }

  if (!canCreate) {
    return (
      <Tooltip content={t("dashboard.createFormula.viewerHint")}>
        <button
          type="button"
          disabled
          aria-disabled="true"
          className={cn(buttonVariants({ variant: "accent" }), "gap-2 opacity-50", className)}
        >
          <Plus className="size-4" />
          {t("dashboard.quickActions.createFormula")}
        </button>
      </Tooltip>
    )
  }

  return (
    <Link href="/formulas/new" className={cn(buttonVariants({ variant: "accent" }), "gap-2", className)}>
      <Plus className="size-4" />
      {t("dashboard.quickActions.createFormula")}
    </Link>
  )
}
