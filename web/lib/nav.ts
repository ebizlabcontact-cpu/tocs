import {
  LayoutDashboard,
  FileSpreadsheet,
  Package,
  Building2,
  ArrowLeftRight,
  ReceiptText,
  Truck,
  Scale,
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
  { label: "Items", href: "/items", icon: Package, mobile: true },
  { label: "Companies", href: "/companies", icon: Building2, mobile: true },
  { label: "Payments", href: "/payments", icon: ArrowLeftRight, mobile: true },
  { label: "Invoices", href: "/invoices", icon: ReceiptText },
  { label: "Logistics", href: "/logistics", icon: Truck },
  { label: "Settlement", href: "/settlement", icon: Scale },
  { label: "Calendar", href: "/calendar", icon: CalendarDays },
  { label: "Reports", href: "/reports", icon: BarChart3, mobile: true },
  { label: "Settings", href: "/settings", icon: Settings },
]
