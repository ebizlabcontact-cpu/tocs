import {
  LayoutDashboard,
  FileSpreadsheet,
  Package,
  Building2,
  CalendarDays,
  BarChart3,
  Settings,
  type LucideIcon,
} from "lucide-react"
import { t } from "@/lib/i18n"

export type NavItem = {
  label: string
  href: string
  icon: LucideIcon
  mobile?: boolean
}

export const navItems: NavItem[] = [
  { label: t("shell.nav.dashboard"), href: "/", icon: LayoutDashboard, mobile: true },
  { label: t("shell.nav.formulas"), href: "/formulas", icon: FileSpreadsheet, mobile: true },
  { label: t("shell.nav.items"), href: "/items", icon: Package, mobile: true },
  { label: t("shell.nav.companies"), href: "/companies", icon: Building2, mobile: true },
  { label: t("shell.nav.calendar"), href: "/calendar", icon: CalendarDays },
  { label: t("shell.nav.reports"), href: "/reports", icon: BarChart3, mobile: true },
  { label: t("shell.nav.settings"), href: "/settings", icon: Settings },
]
