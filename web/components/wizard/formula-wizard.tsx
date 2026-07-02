"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, ArrowRight, Check, X, Building2 } from "lucide-react"
import { useCompany } from "@/components/company-context"
import { Button } from "@/components/ui/button"
import { Stepper, StepperMobile, type Step } from "./stepper"
import { FormulaPreview } from "./formula-preview"
import { emptyWizardState, type WizardState } from "./types"
import {
  StepBasics,
  StepParticipants,
  StepPricing,
  StepSchedule,
  StepLogistics,
  StepReview,
} from "./steps"

const steps: Step[] = [
  { id: 1, label: "Basic Information", hint: "Company, item, trade type" },
  { id: 2, label: "Participants", hint: "Build the trade chain" },
  { id: 3, label: "Pricing", hint: "Line items, costs, and profit share" },
  { id: 4, label: "Payment Schedule", hint: "Expected receipts and payments" },
  { id: 5, label: "Logistics", hint: "Shipment legs and routing" },
  { id: 6, label: "Review", hint: "Confirm and create" },
]

export function FormulaWizard() {
  const router = useRouter()
  const { isAllCompanies } = useCompany()
  const [current, setCurrent] = useState(1)
  const [state, setState] = useState<WizardState>(emptyWizardState)
  const [submitting, setSubmitting] = useState(false)

  if (isAllCompanies) {
    return (
      <div className="animate-fade-in flex min-h-[60vh] items-center justify-center">
        <div className="max-w-md rounded-xl border border-border bg-card p-8 text-center">
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-warning-soft text-warning">
            <Building2 className="size-6" />
          </div>
          <h1 className="text-lg font-semibold text-foreground">Select a company first</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Formulas belong to a single entity, so creation is disabled while viewing All Companies. Choose a
            specific company from the switcher, then start a new formula.
          </p>
          <Button variant="outline" className="mt-5" onClick={() => router.push("/formulas")}>
            <ArrowLeft className="size-4" />
            Back to Formulas
          </Button>
        </div>
      </div>
    )
  }

  const set = (updater: (s: WizardState) => WizardState) => setState(updater)
  const isLast = current === steps.length
  const canProceed = current !== 1 || state.item.trim().length > 0

  function next() {
    if (isLast) {
      setSubmitting(true)
      setTimeout(() => router.push("/formulas"), 900)
      return
    }
    setCurrent((c) => Math.min(steps.length, c + 1))
  }

  function back() {
    setCurrent((c) => Math.max(1, c - 1))
  }

  const active = steps[current - 1]

  return (
    <div className="animate-fade-in pb-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Create Formula</h1>
          <p className="mt-1 text-muted-foreground">Build a transaction as a profit formula.</p>
        </div>
        <Button variant="ghost" size="icon" onClick={() => router.push("/formulas")} aria-label="Cancel">
          <X className="size-5" />
        </Button>
      </div>

      {/* Mobile progress */}
      <div className="mb-5 lg:hidden">
        <StepperMobile steps={steps} current={current} />
        <p className="mt-2 text-sm font-medium text-foreground">
          Step {current} of {steps.length}: {active.label}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[220px_1fr_300px]">
        {/* Desktop stepper */}
        <aside className="hidden lg:block">
          <div className="sticky top-4">
            <Stepper steps={steps} current={current} />
          </div>
        </aside>

        {/* Step content */}
        <div className="min-w-0">
          <div className="rounded-xl border border-border bg-card/40 p-5">
            <h2 className="mb-1 text-lg font-semibold text-foreground">{active.label}</h2>
            <p className="mb-5 text-sm text-muted-foreground">{active.hint}</p>

            {current === 1 && <StepBasics state={state} set={set} />}
            {current === 2 && <StepParticipants state={state} set={set} />}
            {current === 3 && <StepPricing state={state} set={set} />}
            {current === 4 && <StepSchedule state={state} set={set} />}
            {current === 5 && <StepLogistics state={state} set={set} />}
            {current === 6 && <StepReview state={state} set={set} goTo={setCurrent} />}
          </div>

          <div className="mt-4 flex items-center justify-between">
            <Button variant="outline" onClick={back} disabled={current === 1}>
              <ArrowLeft className="size-4" />
              Back
            </Button>
            <Button variant="accent" onClick={next} disabled={!canProceed || submitting}>
              {isLast ? (
                <>
                  <Check className="size-4" />
                  {submitting ? "Creating..." : "Create Formula"}
                </>
              ) : (
                <>
                  Continue
                  <ArrowRight className="size-4" />
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Live preview */}
        <aside>
          <div className="sticky top-4">
            <FormulaPreview state={state} />
          </div>
        </aside>
      </div>
    </div>
  )
}
