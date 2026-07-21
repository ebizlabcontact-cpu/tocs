"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, X, Building2 } from "lucide-react";
import { useCompany } from "@/components/company-context";
import { Button } from "@/components/ui/button";
import { Stepper, StepperMobile, type Step } from "./stepper";
import { FormulaPreview } from "./formula-preview";
import { emptyWizardState, getWizardIssues, type WizardState } from "./types";
import {
  StepBasics,
  StepTradeChain,
  StepSettlement,
  StepLogistics,
  StepReview,
} from "./steps";
import {
  buildCreateFormulaRequest,
  buildFormulaFromWizard,
} from "@/lib/wizard-to-formula";
import { registerCreatedFormula } from "@/lib/formula-preview-session";
import { t } from "@/lib/i18n";

const steps: Step[] = [
  {
    id: 1,
    label: t("formulaWizard.steps.basics"),
    hint: t("formulaWizard.steps.basicsHint"),
  },
  {
    id: 2,
    label: t("formulaWizard.steps.chain"),
    hint: t("formulaWizard.steps.chainHint"),
  },
  {
    id: 3,
    label: t("formulaWizard.steps.settlement"),
    hint: t("formulaWizard.steps.settlementHint"),
  },
  {
    id: 4,
    label: t("formulaWizard.steps.logistics"),
    hint: t("formulaWizard.steps.logisticsHint"),
  },
  {
    id: 5,
    label: t("formulaWizard.steps.review"),
    hint: t("formulaWizard.steps.reviewHint"),
  },
];

export function FormulaWizard() {
  const router = useRouter();
  const { isAllCompanies, selected } = useCompany();
  const [current, setCurrent] = useState(1);
  // V1: a Formula's owner is always the active operating-scope company. There is
  // no independent owner selection and no cross-entity / delegated ownership.
  const [state, setState] = useState<WizardState>(() => ({
    ...emptyWizardState,
    companyId: selected.id,
  }));
  const [submitting, setSubmitting] = useState(false);

  // Keep the owning company locked to the operating scope. If the user switches
  // the header scope while the wizard is open, ownership follows it automatically.
  useEffect(() => {
    setState((s) =>
      s.companyId === selected.id ? s : { ...s, companyId: selected.id },
    );
  }, [selected.id]);

  if (isAllCompanies) {
    return (
      <div className="animate-fade-in flex min-h-[60vh] items-center justify-center">
        <div className="max-w-md rounded-xl border border-border bg-card p-8 text-center">
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-warning-soft text-warning">
            <Building2 className="size-6" />
          </div>
          <h1 className="text-lg font-semibold text-foreground">
            {t("formulaWizard.companyRequired.title")}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("formulaWizard.companyRequired.description")}
          </p>
          <Button
            variant="outline"
            className="mt-5"
            onClick={() => router.push("/formulas")}
          >
            <ArrowLeft className="size-4" />
            {t("formulaWizard.companyRequired.back")}
          </Button>
        </div>
      </div>
    );
  }

  const set = (updater: (s: WizardState) => WizardState) => setState(updater);
  const isLast = current === steps.length;
  const issues = getWizardIssues(state);
  const canProceed = current !== 1 || state.item.trim().length > 0;
  // Final gate: creation is blocked until every validation issue is resolved.
  const canCreate = issues.length === 0;

  function next() {
    if (isLast) {
      if (!canCreate) return;
      setSubmitting(true);
      const createRequest = buildCreateFormulaRequest(state);
      const created = buildFormulaFromWizard(state);
      registerCreatedFormula(created, createRequest);
      setTimeout(() => router.push(`/formulas/${created.id}`), 600);
      return;
    }
    setCurrent((c) => Math.min(steps.length, c + 1));
  }

  function back() {
    setCurrent((c) => Math.max(1, c - 1));
  }

  const active = steps[current - 1];

  return (
    <div className="animate-fade-in pb-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {t("formulaWizard.title")}
          </h1>
          <p className="mt-1 text-muted-foreground">
            {t("formulaWizard.subtitle")}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/formulas")}
          aria-label={t("formulaWizard.cancel")}
        >
          <X className="size-5" />
        </Button>
      </div>

      {/* Mobile progress */}
      <div className="mb-5 lg:hidden">
        <StepperMobile steps={steps} current={current} />
        <p className="mt-2 text-sm font-medium text-foreground">
          {t("formulaWizard.stepProgress", {
            current,
            total: steps.length,
            label: active.label,
          })}
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
            <h2 className="mb-1 text-lg font-semibold text-foreground">
              {active.label}
            </h2>
            <p className="mb-5 text-sm text-muted-foreground">{active.hint}</p>

            {current === 1 && <StepBasics state={state} set={set} />}
            {current === 2 && <StepTradeChain state={state} set={set} />}
            {current === 3 && <StepSettlement state={state} set={set} />}
            {current === 4 && <StepLogistics state={state} set={set} />}
            {current === 5 && (
              <StepReview state={state} set={set} goTo={setCurrent} />
            )}
          </div>

          <div className="mt-4 flex items-center justify-between">
            <Button variant="outline" onClick={back} disabled={current === 1}>
              <ArrowLeft className="size-4" />
              {t("formulaWizard.back")}
            </Button>
            <Button
              variant="accent"
              onClick={next}
              disabled={(isLast ? !canCreate : !canProceed) || submitting}
            >
              {isLast ? (
                <>
                  <Check className="size-4" />
                  {submitting
                    ? t("formulaWizard.creating")
                    : t("formulaWizard.create")}
                </>
              ) : (
                <>
                  {t("formulaWizard.continue")}
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
  );
}
