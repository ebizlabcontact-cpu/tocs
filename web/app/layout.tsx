import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { CompanyProvider } from "@/components/company-context"
import { DateRangeProvider } from "@/components/date-range-context"
import { AppShell } from "@/components/shell/app-shell"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
})

export const metadata: Metadata = {
  title: "TOCS — Transaction Operation Control System",
  description: "Formula First Financial Operating System for B2B trading operations.",
}

export const viewport: Viewport = {
  themeColor: "#0f172a",
  width: "device-width",
  initialScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko" className="bg-background">
      <body className={`${inter.variable} font-sans antialiased`}>
        <CompanyProvider>
          <DateRangeProvider>
            <AppShell>{children}</AppShell>
          </DateRangeProvider>
        </CompanyProvider>
      </body>
    </html>
  )
}
