"use client"

import { useState } from "react"
import { Package, Search, FileText, Ruler, Tag, Hash } from "lucide-react"
import { items, type Item } from "@/lib/items"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export function ItemsExplorer() {
  const [query, setQuery] = useState("")
  const [selectedId, setSelectedId] = useState(items[0]?.id ?? "")

  const filtered = items.filter(
    (it) =>
      it.name.toLowerCase().includes(query.trim().toLowerCase()) ||
      it.category.toLowerCase().includes(query.trim().toLowerCase()) ||
      it.code.toLowerCase().includes(query.trim().toLowerCase()),
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
                  <p className="truncate text-xs text-muted-foreground">
                    {item.code} · {item.category}
                  </p>
                </div>
                <Badge tone={item.active ? "success" : "neutral"} className="ml-auto shrink-0">
                  {item.active ? "Active" : "Inactive"}
                </Badge>
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
              <Badge tone={item.active ? "success" : "neutral"}>{item.active ? "Active" : "Inactive"}</Badge>
            </div>
            <p className="mt-1 font-mono text-xs text-muted-foreground">{item.code}</p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-4 sm:grid-cols-4">
          <MetaItem icon={Hash} label="Item Code" value={item.code} />
          <MetaItem icon={Tag} label="Category" value={item.category} />
          <MetaItem icon={Ruler} label="Default Unit" value={item.unit} />
          <MetaItem icon={FileText} label="Status" value={item.active ? "Active" : "Inactive"} />
        </div>
      </div>

      {/* Spec / Quality Memo */}
      <div className="rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Spec / Quality Memo</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Free-text quality reference. Copied as the default memo when this item is selected in a formula.
            </p>
          </div>
          <FileText className="size-4 text-muted-foreground" />
        </div>
        <div className="p-5">
          <p className="whitespace-pre-line rounded-lg border border-border bg-secondary/30 px-4 py-3 text-sm leading-relaxed text-foreground text-pretty">
            {item.specMemo || "No spec / quality memo recorded."}
          </p>
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
