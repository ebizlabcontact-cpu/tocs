/**
 * TOCS English source copy — single source of truth for user-facing strings.
 *
 * OWNERSHIP (see localization foundation spec):
 * - v0 owns key creation, key naming, and the English values in this file.
 * - Cursor / Product Owner will later add a parallel `ko.ts` with the same key
 *   shape. Do NOT add Korean here.
 *
 * KEY RULES:
 * - Keys are semantic (by meaning), never based on visual position or the
 *   English words themselves. e.g. `shell.nav.dashboard`, not `topLabel`.
 * - Only add keys that are actually rendered. No dead keys.
 * - Empty top-level namespaces below are structural placeholders reserved for
 *   later migration batches (dashboard, formulas, etc.); they contain no leaf
 *   keys, so they are not dead keys.
 */
export const en = {
  common: {
    actions: {
      signIn: "Sign in",
      signOut: "Sign out",
    },
    badges: {
      preview: "Preview",
    },
  },
  auth: {
    login: {
      title: "Sign in to TOCS",
      subtitle: "Mock preview auth — no API call",
      email: "Email",
      password: "Password",
      submit: "Sign in (Preview)",
      submitting: "Signing in…",
      demoTitle: "Demo accounts",
    },
  },
  shell: {
    nav: {
      sectionLabel: "Operations",
      dashboard: "Dashboard",
      formulas: "Formulas",
      items: "Items",
      companies: "Companies",
      calendar: "Calendar",
      reports: "Reports",
      settings: "Settings",
    },
    search: {
      placeholder: "Search formulas, invoices…",
      tooltip: "Search — coming in a future release (preview UI).",
    },
    notifications: {
      tooltip: "Notifications — not available in preview.",
      label: "Notifications",
    },
    ai: {
      tooltip: "AI Assistant — preview shell only.",
      label: "AI Assistant",
      openLabel: "Open AI Assistant",
      title: "TOCS Assistant",
      subtitle: "Ask about your operations",
      tryAsking: "Try asking",
      inputPlaceholder: "Coming soon…",
      examples: {
        profitDecrease: "Why did profit decrease this month?",
        unpaidFormulas: "Show unpaid formulas.",
        topProfitCompany: "Which company generated the most profit?",
        closeableThisWeek: "List formulas closeable this week.",
      },
    },
    company: {
      scopeLabel: "Operating scope",
      scopeNote:
        "Sets operating, permission, write, and API scope. Changing operating scope changes the accessible formula set.",
    },
    analyticsCompany: {
      allInScope: "All in scope",
      perspectiveLabel: "Analytics perspective",
      helpText:
        "Company filters analyze formulas from a selected company's perspective. Options come from the accessible formula set, not the company master.",
    },
    dateRange: {
      last7Days: "Last 7 Days",
      last30Days: "Last 30 Days",
      thisMonth: "This Month",
      lastMonth: "Last Month",
      thisYear: "This Year",
      custom: "Custom Range",
      startDate: "Start Date",
      endDate: "End Date",
      apply: "Apply Range",
      note: "Prototype selector — UI state only. Authoritative period filtering runs in backend services after integration.",
    },
    formulaFirst: {
      title: "Formula First",
      body: "Every number traces back to a formula — your single source of truth.",
    },
  },

  dashboard: {
    header: {
      title: "Command Center",
      description: "Dashboard figures are derived from formulas — {company} · {range}.",
      perspectiveDescription:
        "Dashboard figures are derived from formulas — {company} scope, analyzed from {analyticsCompany}'s perspective · {range}.",
    },
    summary: {
      realizedProfit: "Realized Profit",
      totalLoss: "Total Loss",
      receivable: "Accounts Receivable",
      payable: "Accounts Payable",
      upcomingReceipts: "Upcoming Receipts",
      upcomingPayments: "Upcoming Payments",
      closeableFormulas: "Closeable Formulas",
      invoiceUnmatched: "Invoice Unmatched",
      comparedWithPrevious: "{percent}% vs prev.",
    },
    profit: {
      title: "Realized Profit · {range}",
      reportsAction: "Reports",
      chartSeries: "Realized Profit",
      weekLabel: "Week {count}",
    },
    lossRanking: {
      title: "Loss Formula Ranking",
      viewAction: "View losses",
      emptyTitle: "No loss formulas",
      emptyDescription: "Every formula is currently profitable.",
    },
    cashflow: {
      receiptsTitle: "Upcoming Receipts",
      paymentsTitle: "Upcoming Payments",
      allReceiptsAction: "All receipts",
      allPaymentsAction: "All payments",
      emptyReceipts: "No upcoming receipts.",
      emptyPayments: "No upcoming payments.",
    },
    formulas: {
      recentTitle: "Recent Formulas",
      allAction: "All formulas",
      attentionTitle: "Attention Required",
      reviewAction: "Review",
      attentionEmpty: "Nothing needs attention right now.",
    },
    quickActions: {
      title: "Quick Actions",
      createFormula: "Create Formula",
      upcomingReceipts: "Upcoming Receipts",
      upcomingPayments: "Upcoming Payments",
      reviewInvoicing: "Review Invoicing",
      unavailableHint: "Switch to a specific company to use quick actions.",
    },
    createFormula: {
      specificCompanyHint: "Select a specific company to create a formula. Creation is disabled in All Companies view.",
      viewerHint: "VIEWER role cannot create formulas. Sign in as MANAGER or higher.",
    },
    relativeTime: {
      today: "Today",
      yesterday: "Yesterday",
      daysAgo: "{count}d ago",
      weeksAgo: "{count}w ago",
    },
    attention: {
      negativeProfit: "Realized profit is negative — review pricing and settlement.",
      invoiceUnmatched: "Invoice unmatched — 1 document needs reconciliation.",
      paymentOverdue: "Payment overdue — counterparty settlement pending.",
      generic: "Needs attention.",
    },
  },

  // Reserved for later localization batches — intentionally empty (no dead keys).
  formulas: {},
  companies: {},
  items: {},
  calendar: {},
  reports: {},
  status: {
    draft: "Draft",
    active: "Active",
    invoicing: "Invoicing",
    closeable: "Closeable",
    closed: "Closed",
    scheduled: "Scheduled",
    partial: "Partial",
    completed: "Completed",
    overdue: "Overdue",
    canceled: "Canceled",
  },
  validation: {},
  tooltips: {},
  comingSoon: {},
} as const

export type EnDictionary = typeof en
