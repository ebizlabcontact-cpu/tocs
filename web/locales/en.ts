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
      sectionLabel: "Operations Hub",
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
    dateRange: {
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

  // Reserved for later localization batches — intentionally empty (no dead keys).
  dashboard: {},
  formulas: {},
  companies: {},
  items: {},
  calendar: {},
  reports: {},
  status: {},
  validation: {},
  tooltips: {},
  comingSoon: {},
} as const

export type EnDictionary = typeof en
