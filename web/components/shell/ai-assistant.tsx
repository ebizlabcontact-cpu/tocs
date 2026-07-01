"use client"

import * as React from "react"
import { Sparkles, X, ArrowUp } from "lucide-react"
import { cn } from "@/lib/utils"

const examples = [
  "Why did profit decrease this month?",
  "Show unpaid formulas.",
  "Which company generated the most profit?",
  "List formulas closeable this week.",
]

export function AiAssistant() {
  const [open, setOpen] = React.useState(false)

  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "fixed bottom-20 right-4 z-50 flex size-12 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-[var(--shadow-lifted)] transition-transform hover:scale-105 lg:bottom-6 lg:right-6 lg:size-14",
        )}
        aria-label="Open AI Assistant"
      >
        {open ? <X className="size-5" /> : <Sparkles className="size-5" />}
      </button>

      {open && (
        <div className="fixed bottom-36 right-4 z-50 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-[var(--radius-xl)] border border-border bg-popover shadow-[var(--shadow-lifted)] animate-fade-in lg:bottom-24 lg:right-6">
          <div className="flex items-center gap-2 border-b border-border p-4">
            <span className="flex size-8 items-center justify-center rounded-[var(--radius-md)] bg-accent-soft text-accent">
              <Sparkles className="size-4" />
            </span>
            <div>
              <p className="text-sm font-semibold text-foreground">TOCS Assistant</p>
              <p className="text-xs text-muted-foreground">Ask about your operations</p>
            </div>
          </div>
          <div className="p-4">
            <p className="mb-2 text-xs font-medium text-muted-foreground">Try asking</p>
            <div className="flex flex-col gap-1.5">
              {examples.map((ex) => (
                <button
                  key={ex}
                  className="rounded-[var(--radius-md)] border border-border bg-card px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-secondary"
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>
          <div className="border-t border-border p-3">
            <div className="flex items-center gap-2 rounded-[var(--radius-md)] border border-border bg-card px-3 py-2">
              <input
                disabled
                placeholder="Coming soon…"
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
              <span className="flex size-6 items-center justify-center rounded-md bg-secondary text-muted-foreground">
                <ArrowUp className="size-3.5" />
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
