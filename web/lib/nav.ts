import {
  LayoutDashboard,
  FileSpreadsheet,
  ArrowLeftRight,
  ReceiptText,
  Truck,
  Scale,
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
  { label: "Payments", href: "/payments", icon: ArrowLeftRight, mobile: true },
  { label: "Invoices", href: "/invoices", icon: ReceiptText },
  { label: "Logistics", href: "/logistics", icon: Truck },
  { label: "Settlement", href: "/settlement", icon: Scale },
  { label: "Reports", href: "/reports", icon: BarChart3, mobile: true },
  { label: "Settings", href: "/settings", icon: Settings },
]
