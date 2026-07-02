import {
  LayoutDashboard,
  FileSpreadsheet,
  Building2,
  CalendarDays,
  BarChart3,
  Settings,
  type LucideIcon,
} from "lucide-react"

export type NavItem = {
  label: string
  href: string
  icon: LucideIcon
  mobile?: boolean
}

export const navItems: NavItem[] = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard, mobile: true },
  { label: "Formulas", href: "/formulas", icon: FileSpreadsheet, mobile: true },
  { label: "Companies", href: "/companies", icon: Building2, mobile: true },
  { label: "Calendar", href: "/calendar", icon: CalendarDays, mobile: true },
  { label: "Reports", href: "/reports", icon: BarChart3, mobile: true },
  { label: "Settings", href: "/settings", icon: Settings },
]
