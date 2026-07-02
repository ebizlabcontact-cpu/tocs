"use client"

import { useState } from "react"
import { Package, Search, FileText, Ruler, Tag } from "lucide-react"
import { items, type Item, type ItemSpecField } from "@/lib/items"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

function specTypeLabel(field: ItemSpecField) {
  if (field.type === "select") return "Choice"
  if (field.type === "number") return field.unit ? `Number (${field.unit})` : "Number"
  return "Text"
}

export function ItemsExplorer() {
  const [query, setQuery] = useState("")
  const [selectedId, setSelectedId] = useState(items[0]?.id ?? "")

  const filtered = items.filter(
    (it) =>
      it.name.toLowerCase().includes(query.trim().toLowerCase()) ||
      it.category.toLowerCase().includes(query.trim().toLowerCase()),
  )

  const selected = items.find((it) => it.id === selectedId) ?? filtered[0]

  return (
    <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
      {/* Master list */}
      <aside className="flex flex-col gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search items..."
            className="w-full rounded-[var(--radius-md)] border border-border bg-card py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-ring/40"
          />
        </div>

        <div className="flex flex-col gap-2">
          {filtered.map((item) => {
            const isActive = selected?.id === item.id
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedId(item.id)}
                className={cn(
                  "flex items-center gap-3 rounded-xl border p-3 text-left transition-colors",
                  isActive
                    ? "border-accent/50 bg-accent-soft"
                    : "border-border bg-card hover:border-accent/30",
                )}
              >
                <span
                  className={cn(
                    "flex size-10 shrink-0 items-center justify-center rounded-lg",
                    isActive ? "bg-accent text-accent-foreground" : "bg-secondary text-muted-foreground",
                  )}
                >
                  <Package className="size-5" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{item.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{item.category}</p>
                </div>
                <span className="ml-auto shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
                  {item.specTemplate.length} specs
                </span>
              </button>
            )
          })}
          {filtered.length === 0 && (
            <div className="rounded-xl border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
              No items match “{query}”.
            </div>
          )}
        </div>
      </aside>

      {/* Detail */}
      {selected ? <ItemDetail item={selected} /> : null}
    </div>
  )
}

function ItemDetail({ item }: { item: Item }) {
  return (
    <div className="flex flex-col gap-5">
      {/* Detail header */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-start gap-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
            <Package className="size-6" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-foreground">{item.name}</h2>
              <Badge tone="accent">{item.category}</Badge>
            </div>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground text-pretty">{item.description}</p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-4 sm:grid-cols-3">
          <MetaItem icon={Ruler} label="Default Unit" value={item.unit} />
          <MetaItem icon={FileText} label="Spec Fields" value={String(item.specTemplate.length)} />
          <MetaItem icon={Tag} label="Item ID" value={item.id} />
        </div>
      </div>

      {/* Specification template preview */}
      <div className="rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Specification Template</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              These fields auto-populate when this item is selected in a formula.
            </p>
          </div>
          <FileText className="size-4 text-muted-foreground" />
        </div>

        {/* Field rows */}
        <div className="divide-y divide-border">
          {item.specTemplate.map((field) => (
            <div key={field.key} className="flex items-center gap-4 px-5 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{field.label}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {field.options ? field.options.join(" · ") : specTypeLabel(field)}
                </p>
              </div>
              <Badge tone="outline">{specTypeLabel(field)}</Badge>
            </div>
          ))}
        </div>

        {/* Live template preview (disabled inputs) */}
        <div className="border-t border-border bg-secondary/30 p-5">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Form Preview</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {item.specTemplate.map((field) => (
              <div key={field.key}>
                <label className="mb-1.5 block text-sm font-medium text-foreground">
                  {field.label}
                </label>
                {field.type === "select" ? (
                  <select
                    disabled
                    className="w-full cursor-not-allowed rounded-[var(--radius-md)] border border-border bg-card px-3 py-2 text-sm text-muted-foreground"
                  >
                    <option>{field.options?.[0] ?? "Select..."}</option>
                  </select>
                ) : (
                  <div className="relative">
                    <input
                      disabled
                      placeholder={field.placeholder ?? ""}
                      className="w-full cursor-not-allowed rounded-[var(--radius-md)] border border-border bg-card px-3 py-2 text-sm text-muted-foreground placeholder:text-muted-foreground/70"
                    />
                    {field.unit && (
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                        {field.unit}
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function MetaItem({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Ruler
  label: string
  value: string
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="truncate text-sm font-medium text-foreground">{value}</p>
      </div>
    </div>
  )
}
