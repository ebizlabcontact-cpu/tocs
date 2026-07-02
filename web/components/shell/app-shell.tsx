import type React from "react"
import { Header } from "./header"
import { Sidebar } from "./sidebar"
import { BottomNav } from "./bottom-nav"
import { AiAssistant } from "./ai-assistant"
import { AllCompaniesBanner } from "./all-companies-banner"

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <div className="flex flex-1">
        <Sidebar />
        <main className="min-w-0 flex-1 pb-20 lg:pb-0">
          <AllCompaniesBanner />
          <div className="mx-auto w-full max-w-[1400px] px-4 py-6 md:px-6 md:py-8">{children}</div>
        </main>
      </div>
      <BottomNav />
      <AiAssistant />
    </div>
  )
}
