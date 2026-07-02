import type { LucideIcon } from "lucide-react"
import { Card } from "@/components/ui/card"

export function ComingSoon({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon
  title: string
  description: string
}) {
  return (
    <Card className="flex flex-col items-center justify-center gap-3 border-dashed py-20 text-center">
      <span className="flex size-12 items-center justify-center rounded-[var(--radius-lg)] bg-secondary text-muted-foreground">
        <Icon className="size-6" />
      </span>
      <div>
        <p className="text-base font-semibold text-foreground">{title}</p>
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground text-pretty">{description}</p>
      </div>
    </Card>
  )
}
