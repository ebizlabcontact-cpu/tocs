import type { TradeType } from "@/lib/types";
import { t } from "@/lib/i18n";

export type WizardCost = {
  id: string;
  label: string;
  amount: number;
};

/**
 * A node in the trade chain. Roles are formula-specific and selected
 * per row — there are no fixed Buyer/Seller/Carrier top-level fields.
 * Pricing (quantity/buy/sell) lives on the node so the commercial chain
 * and its economics are a single Formula-derived structure.
 */
export type WizardParticipant = {
  id: string;
  company: string;
  roleGroup: string;
  natureGroup: string;
  paymentGroup: string;
  /** Units moving through this node. */
  quantity: number;
  /** Price this node pays to acquire. */
  buyPrice: number;
  /** Price this node charges downstream. */
  sellPrice: number;
  /** Chain start point toggle. */
  startPoint: boolean;
  /** Chain end point toggle. */
  endPoint: boolean;
};

/**
 * Cross-border currency structure. UI/preview only — no FX API, engine, or
 * persistence. Domestic trades ignore this (KRW / Korea).
 */
export type WizardFx = {
  purchaseCountry: string;
  salesCountry: string;
  baseCurrency: string;
  txnCurrency: string;
  /** Rate agreed at contract time. */
  contractExchangeRate: number;
  /** Revalued rate for settlement preview (e.g. at fixing/adjustment). */
  adjustedExchangeRate: number;
  foreignUnitPrice: number;
};

export type WizardScheduleItem = {
  id: string;
  type: "receipt" | "payment";
  counterparty: string;
  amount: number;
  dueDate: string;
};

export type WizardLogisticsLeg = {
  id: string;
  mode: "sea" | "air" | "land";
  origin: string;
  destination: string;
  eta: string;
};

export type WizardState = {
  companyId: string;
  itemId: string;
  item: string;
  tradeType: TradeType;
  quantity: number;
  unit: string;
  /** Formula timeline basis (Step 1). Trade Date and Contract Date. */
  tradeDate: string;
  contractDate: string;
  /** Free-text spec / quality memo (Step 1). No structured spec fields. */
  specMemo: string;
  /** Internal memo (Step 1). */
  internalMemo: string;
  /** Cross-border currency structure (Step 1). Preview only. */
  fx: WizardFx;
  participants: WizardParticipant[];
  costs: WizardCost[];
  /** Formula Share — a subtracted KRW amount (deal-level), not a percentage. */
  shareAmount: number;
  schedule: WizardScheduleItem[];
  logistics: WizardLogisticsLeg[];
};

/**
 * Single derivation of every headline figure from the Formula draft.
 * All wizard views (live summary, trade chain, settlement, review) read
 * from this so numbers always trace back to Formula inputs.
 */
export function deriveFormula(state: WizardState) {
  const nodes = state.participants;
  const starts = nodes.filter((p) => p.startPoint);
  const ends = nodes.filter((p) => p.endPoint);
  // Endpoints are authoritative — no price-pattern inference.
  // Cost derives from the chain start (buying-cost side): the price at which
  // goods enter the chain (start node's sell unit price × quantity).
  // Revenue derives from the chain end (selling-revenue side): what the final
  // buyer pays (end node's buy unit price × quantity).
  // If no start/end is designated the figure is 0 (validation surfaces this).
  const expectedRevenue = ends.reduce(
    (s, p) => s + (p.buyPrice || 0) * (p.quantity || 0),
    0,
  );
  const expectedCost = starts.reduce(
    (s, p) => s + (p.sellPrice || 0) * (p.quantity || 0),
    0,
  );
  const costs = state.costs.reduce((s, c) => s + (c.amount || 0), 0);
  const grossMargin = expectedRevenue - expectedCost - costs;
  // Canonical model (DL-009): share is a subtracted KRW amount, not a percentage.
  // 예상순이익 = 총매출 − 총매입 − 비용 − 셰어
  const share = state.shareAmount || 0;
  const expectedProfit = grossMargin - share;
  const totalQuantity = state.participants.reduce(
    (s, p) => s + (p.quantity || 0),
    0,
  );
  const participantCount = state.participants.filter(
    (p) => p.company.trim().length > 0,
  ).length;
  return {
    expectedRevenue,
    expectedCost,
    costs,
    grossMargin,
    share,
    expectedProfit,
    totalQuantity,
    participantCount,
    expectedReceipts: expectedRevenue,
    expectedPayments: expectedCost + costs,
  };
}

/** Local calendar date (YYYY-MM-DD) for date input defaults. */
function todayISODate() {
  const now = new Date();
  return new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).toLocaleDateString("en-CA");
}

export const emptyWizardState: WizardState = {
  companyId: "c1",
  itemId: "",
  item: "",
  tradeType: "import",
  quantity: 0,
  unit: "MT",
  tradeDate: todayISODate(),
  contractDate: todayISODate(),
  specMemo: "",
  internalMemo: "",
  fx: {
    purchaseCountry: "",
    salesCountry: "",
    baseCurrency: "KRW",
    txnCurrency: "USD",
    contractExchangeRate: 0,
    adjustedExchangeRate: 0,
    foreignUnitPrice: 0,
  },
  participants: [
    {
      id: "p1",
      company: "",
      roleGroup: "supplier",
      natureGroup: "manufacturer",
      paymentGroup: "prepaid",
      quantity: 0,
      buyPrice: 0,
      sellPrice: 0,
      startPoint: true,
      endPoint: false,
    },
  ],
  costs: [{ id: "co1", label: "Freight", amount: 0 }],
  shareAmount: 0,
  schedule: [],
  logistics: [],
};

/* Formula-specific option groups for the trade chain (Step 2). */
/** Formula role (what this participant does in the deal). */
export const roleGroupOptions = [
  { value: "supplier", label: t("formulaWizard.chain.supplier") },
  { value: "buyer", label: t("formulaWizard.chain.buyer") },
  { value: "carrier", label: t("formulaWizard.chain.carrier") },
  { value: "financial", label: t("formulaWizard.chain.financialPayment") },
  { value: "other", label: t("formulaWizard.chain.other") },
];

/** Business nature of the participant company. */
export const natureGroupOptions = [
  { value: "manufacturer", label: t("formulaWizard.chain.manufacturer") },
  { value: "distributor", label: t("formulaWizard.chain.distributor") },
  { value: "trading", label: t("formulaWizard.chain.tradingCompany") },
  { value: "logistics", label: t("formulaWizard.chain.logisticsCompany") },
  { value: "financial", label: t("formulaWizard.chain.financial") },
  { value: "other", label: t("formulaWizard.chain.other") },
];

export const paymentGroupOptions = [
  { value: "prepaid", label: t("formulaWizard.chain.prepaid") },
  { value: "credit", label: t("formulaWizard.chain.credit") },
  { value: "postpaid", label: t("formulaWizard.chain.postpaid") },
];

/* Cross-border option lists (Step 1 FX section). Preview only. */
export const countryOptions = [
  "Korea",
  "China",
  "Vietnam",
  "Malaysia",
  "Indonesia",
  "Singapore",
  "Japan",
  "Netherlands",
  "United States",
  "Germany",
];

export const currencyOptions = ["KRW", "USD", "EUR", "JPY", "CNY", "SGD"];

/** Domestic trades are fixed to Korea / KRW — FX is hidden. */
export function isCrossBorder(tradeType: TradeType) {
  return tradeType !== "domestic";
}

/** Derived KRW-converted figures from the FX inputs (preview only). */
export function deriveFx(fx: WizardFx, quantity: number) {
  const foreignTotal = (fx.foreignUnitPrice || 0) * (quantity || 0);
  const krwUnitPrice =
    (fx.foreignUnitPrice || 0) * (fx.contractExchangeRate || 0);
  const krwTotal = foreignTotal * (fx.contractExchangeRate || 0);
  const adjustedKrwTotal = foreignTotal * (fx.adjustedExchangeRate || 0);
  return { foreignTotal, krwUnitPrice, krwTotal, adjustedKrwTotal };
}

/**
 * Creation validation gates (P0-4). Returns a list of human-readable issues;
 * an empty array means the Formula draft is ready to create. Pure/UI-only —
 * no persistence, no backend enforcement.
 */
export function getWizardIssues(state: WizardState): string[] {
  const issues: string[] = [];

  if (!state.item.trim()) issues.push(t("formulaWizard.validation.selectItem"));
  if (!(state.quantity > 0))
    issues.push(t("formulaWizard.validation.quantity"));
  if (!state.tradeDate) issues.push(t("formulaWizard.validation.tradeDate"));
  if (!state.contractDate)
    issues.push(t("formulaWizard.validation.contractDate"));

  const participants = state.participants;
  if (participants.length < 1)
    issues.push(t("formulaWizard.validation.participantRequired"));
  participants.forEach((p, i) => {
    if (!p.company.trim())
      issues.push(
        t("formulaWizard.validation.participantCompany", {
          letter: String.fromCharCode(65 + i),
        }),
      );
  });

  const starts = participants.filter((p) => p.startPoint);
  const ends = participants.filter((p) => p.endPoint);
  if (starts.length < 1)
    issues.push(t("formulaWizard.validation.startRequired"));
  if (starts.length > 1) issues.push(t("formulaWizard.validation.startSingle"));
  if (ends.length < 1) issues.push(t("formulaWizard.validation.endRequired"));
  if (ends.length > 1) issues.push(t("formulaWizard.validation.endSingle"));

  if (starts.some((p) => !((p.sellPrice || 0) > 0)))
    issues.push(t("formulaWizard.validation.startPrice"));
  if (ends.some((p) => !((p.buyPrice || 0) > 0)))
    issues.push(t("formulaWizard.validation.endPrice"));

  if (isCrossBorder(state.tradeType)) {
    const fx = state.fx;
    if (!fx.purchaseCountry)
      issues.push(t("formulaWizard.validation.purchaseCountry"));
    if (!fx.salesCountry)
      issues.push(t("formulaWizard.validation.salesCountry"));
    if (!fx.txnCurrency)
      issues.push(t("formulaWizard.validation.transactionCurrency"));
    if (!(fx.contractExchangeRate > 0))
      issues.push(t("formulaWizard.validation.contractRate"));
    if (!(fx.adjustedExchangeRate > 0))
      issues.push(t("formulaWizard.validation.adjustedRate"));
  }

  return issues;
}
