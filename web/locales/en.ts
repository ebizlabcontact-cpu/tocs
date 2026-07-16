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

  formulas: {
    list: {
      header: {
        title: "Formulas",
        description: "Every transaction as a formula. Filter, search, and drill into any deal.",
      },
      filters: {
        searchPlaceholder: "Search by number, item, or counterparty...",
        clearSearch: "Clear search",
        all: "All",
        allFormulas: "All formulas",
        active: "Active",
        invoicing: "Invoicing",
        closeable: "Closeable",
        closed: "Closed",
        loss: "Loss",
        lossMaking: "Loss-making",
        profitable: "Profitable",
        hasReceivable: "Has receivable",
        hasPayable: "Has payable",
        invoiceUnmatched: "Invoice unmatched",
        needsAttention: "Needs attention",
        clear: "Clear filters",
      },
      context: {
        label: "Context",
        scope: "Scope",
        perspective: "Perspective",
        range: "Range",
        metric: "Metric",
      },
      results: {
        summary: "{count} formulas · {value} total value",
      },
      sort: {
        recent: "Most recent",
        highestProfit: "Highest profit",
        largestValue: "Largest value",
      },
      view: {
        table: "Table view",
        cards: "Card view",
      },
      table: {
        formulaNumber: "Formula No",
        item: "Item",
        expectedProfit: "Expected Profit",
        realizedProfit: "Realized Profit",
        receivable: "Receivable",
        payable: "Payable",
        status: "Status",
      },
      card: {
        sell: "Sell",
        buy: "Buy",
        realized: "Realized",
        expected: "Expected",
        receivable: "Receivable {value}",
      },
      tradeType: {
        import: "Import",
        export: "Export",
        domestic: "Domestic",
        triangular: "Triangular",
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
      empty: {
        allTitle: "No formulas yet",
        allDescription: "Create your first formula to start tracking deals.",
        activeTitle: "No active formulas",
        activeDescription: "Nothing is currently in progress for this company.",
        invoicingTitle: "No formulas awaiting invoicing",
        invoicingDescription: "All invoices are up to date.",
        closeableTitle: "No formulas ready to close",
        closeableDescription: "Formulas appear here once fully settled.",
        closedTitle: "No closed formulas",
        closedDescription: "Completed formulas will be listed here.",
        lossTitle: "No loss-making formulas",
        lossDescription: "Great — nothing is currently running at a loss.",
        profitTitle: "No profitable formulas yet",
        profitDescription: "Realized profit appears here after settlement.",
        receivableTitle: "No outstanding receivables",
        receivableDescription: "Every counterparty is paid up.",
        payableTitle: "No outstanding payables",
        payableDescription: "You have no pending payments to make.",
        unmatchedTitle: "All invoices matched",
        unmatchedDescription: "No invoice discrepancies to resolve.",
        attentionTitle: "Nothing needs attention",
        attentionDescription: "All formulas are healthy right now.",
        noResultsTitle: "No formulas match your search",
        noResultsDescription: "Nothing matches “{query}”. Try a different term.",
      },
    },
  },
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
