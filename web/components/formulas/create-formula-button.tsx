"use client"

import Link from "next/link"
import { Plus } from "lucide-react"
import { useCompany } from "@/components/company-context"
import { useAuth } from "@/components/auth/auth-provider"
import { roleAtLeast } from "@/lib/permissions"
import { buttonVariants } from "@/components/ui/button"
import { Tooltip } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

const ALL_COMPANIES_HINT = "Select a specific company to create a formula. Creation is disabled in All Companies view."

const VIEWER_HINT = "VIEWER role cannot create formulas. Sign in as MANAGER or higher."

export function CreateFormulaButton({ className }: { className?: string }) {
  const { isAllCompanies } = useCompany()
  const { user } = useAuth()
  const canCreate = user ? roleAtLeast(user.role, "MANAGER") : false

  if (isAllCompanies) {
    return (
      <Tooltip content={ALL_COMPANIES_HINT}>
        <button
          type="button"
          disabled
          aria-disabled="true"
          className={cn(buttonVariants({ variant: "accent" }), "gap-2 opacity-50", className)}
        >
          <Plus className="size-4" />
          Create Formula
        </button>
      </Tooltip>
    )
  }

  if (!canCreate) {
    return (
      <Tooltip content={VIEWER_HINT}>
        <button
          type="button"
          disabled
          aria-disabled="true"
          className={cn(buttonVariants({ variant: "accent" }), "gap-2 opacity-50", className)}
        >
          <Plus className="size-4" />
          Create Formula
        </button>
      </Tooltip>
    )
  }

  return (
    <Link href="/formulas/new" className={cn(buttonVariants({ variant: "accent" }), "gap-2", className)}>
      <Plus className="size-4" />
      Create Formula
    </Link>
  )
}
