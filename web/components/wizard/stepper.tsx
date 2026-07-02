import { Check } from "lucide-react"
import { cn } from "@/lib/utils"

export type Step = { id: number; label: string; hint: string }

export function Stepper({ steps, current }: { steps: Step[]; current: number }) {
  return (
    <ol className="flex flex-col gap-1">
      {steps.map((step) => {
        const done = step.id < current
        const active = step.id === current
        return (
          <li key={step.id} className="flex items-center gap-3 rounded-lg px-3 py-2">
            <span
              className={cn(
                "flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold transition-colors",
                done && "border-transparent bg-success text-success-foreground",
                active && "border-accent bg-accent text-accent-foreground",
                !done && !active && "border-border bg-card text-muted-foreground",
              )}
            >
              {done ? <Check className="size-4" /> : step.id}
            </span>
            <div className="min-w-0">
              <p className={cn("text-sm font-medium", active ? "text-foreground" : "text-muted-foreground")}>
                {step.label}
              </p>
              <p className="truncate text-xs text-muted-foreground">{step.hint}</p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

export function StepperMobile({ steps, current }: { steps: Step[]; current: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {steps.map((step) => (
        <span
          key={step.id}
          className={cn(
            "h-1.5 flex-1 rounded-full transition-colors",
            step.id < current && "bg-success",
            step.id === current && "bg-accent",
            step.id > current && "bg-border",
          )}
        />
      ))}
    </div>
  )
}
