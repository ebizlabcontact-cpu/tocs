import { formatCurrency, formatNumber, formatDate, cn } from "@/lib/utils";
import { t } from "@/lib/i18n";
import { deriveFormula, type WizardState } from "./types";
import { Sparkles } from "lucide-react";

export function FormulaPreview({ state }: { state: WizardState }) {
  const d = deriveFormula(state);

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center gap-2">
        <span className="flex size-7 items-center justify-center rounded-lg bg-accent-soft text-accent">
          <Sparkles className="size-4" />
        </span>
        <h3 className="text-sm font-semibold text-foreground">
          {t("formulaWizard.preview.title")}
        </h3>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2">
        <Counter
          label={t("formulaWizard.preview.formulaQuantity")}
          value={
            state.quantity
              ? `${formatNumber(state.quantity)} ${state.unit}`
              : `0 ${state.unit}`
          }
        />
        <Counter
          label={t("formulaWizard.common.participants")}
          value={String(d.participantCount)}
        />
        <Counter
          label={t("formulaWizard.common.tradeDate")}
          value={state.tradeDate ? formatDate(state.tradeDate) : "—"}
        />
        <Counter
          label={t("formulaWizard.common.contractDate")}
          value={state.contractDate ? formatDate(state.contractDate) : "—"}
        />
      </div>
      {d.totalQuantity !== state.quantity && d.totalQuantity > 0 && (
        <p className="mb-3 -mt-2 text-[11px] leading-relaxed text-muted-foreground">
          {t("formulaWizard.preview.quantityMismatch", {
            quantity: formatNumber(d.totalQuantity),
            unit: state.unit,
          })}
        </p>
      )}

      <div className="space-y-2.5">
        <Row
          label={t("formulaWizard.common.expectedRevenue")}
          value={d.expectedRevenue}
          tone="pos"
        />
        <Row
          label={t("formulaWizard.common.expectedCost")}
          value={d.expectedCost}
          minus
        />
        <Row label={t("formulaWizard.common.costs")} value={d.costs} minus />
        <div className="border-t border-dashed border-border pt-2.5">
          <Row
            label={t("formulaWizard.common.grossMargin")}
            value={d.grossMargin}
            tone={d.grossMargin >= 0 ? "pos" : "neg"}
            bold
          />
        </div>
        <Row
          label={t("formulaWizard.common.formulaShare")}
          value={d.share}
          minus
        />
      </div>

      <div className="mt-4 rounded-lg bg-secondary/60 p-3">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          {t("formulaWizard.common.expectedProfit")}
        </p>
        <p
          className={cn(
            "mt-1 font-mono text-2xl font-bold tabular-nums",
            d.expectedProfit >= 0 ? "text-success" : "text-danger",
          )}
        >
          {formatCurrency(d.expectedProfit)}
        </p>
      </div>

      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
        {t("formulaWizard.preview.helpBefore")}
        <span className="font-medium text-foreground">
          {t("formulaWizard.preview.helpEmphasis")}
        </span>
        {t("formulaWizard.preview.helpAfter")}
      </p>
    </div>
  );
}

function Counter({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-secondary/40 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-foreground">
        {value}
      </p>
    </div>
  );
}

function Row({
  label,
  value,
  tone,
  minus,
  bold,
}: {
  label: string;
  value: number;
  tone?: "pos" | "neg";
  minus?: boolean;
  bold?: boolean;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={cn(
          "font-mono tabular-nums",
          bold ? "font-bold" : "font-medium",
          tone === "pos" && "text-success",
          tone === "neg" && "text-danger",
          !tone && "text-foreground",
        )}
      >
        {minus && value > 0 ? "−" : ""}
        {formatCurrency(Math.abs(value))}
      </span>
    </div>
  );
}
