"use client"

import { useMemo, useState } from "react"
import { Package, Search, FileText, Ruler, Tag, Hash, Plus, Pencil, Trash2, Layers } from "lucide-react"
import { items as seedItems, unitOptions, type Item } from "@/lib/items"
import { formulas } from "@/lib/mock-data"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Modal } from "@/components/ui/modal"
import { SidePanel } from "@/components/ui/side-panel"
import { Field, Input, Select } from "@/components/ui/field"
import { uid } from "@/lib/utils"

type Draft = Omit<Item, "id">

const emptyDraft: Draft = {
  code: "",
  name: "",
  category: "",
  unit: "MT",
  active: true,
  specMemo: "",
}

/** Formulas that reference an item by name (Formula-derived usage). */
function formulasUsing(name: string) {
  return formulas.filter((f) => f.item === name)
}

export function ItemsExplorer() {
  // Mock local state only — no persistence, no backend.
  const [list, setList] = useState<Item[]>(seedItems)
  const [query, setQuery] = useState("")
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<Item | null>(null)
  const [deleting, setDeleting] = useState<Item | null>(null)

  const filtered = useMemo(
    () =>
      list.filter(
        (it) =>
          it.name.toLowerCase().includes(query.trim().toLowerCase()) ||
          it.category.toLowerCase().includes(query.trim().toLowerCase()) ||
          it.code.toLowerCase().includes(query.trim().toLowerCase()),
      ),
    [list, query],
  )

  const selected = list.find((it) => it.id === selectedId) ?? null

  function handleCreate(draft: Draft) {
    setList((prev) => [{ ...draft, id: uid() }, ...prev])
    setCreateOpen(false)
  }

  function handleEdit(draft: Draft) {
    if (!editing) return
    setList((prev) => prev.map((it) => (it.id === editing.id ? { ...it, ...draft } : it)))
    setEditing(null)
  }

  function handleDelete() {
    if (!deleting) return
    setList((prev) => prev.filter((it) => it.id !== deleting.id))
    if (selectedId === deleting.id) setSelectedId(null)
    setDeleting(null)
  }

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative sm:max-w-xs sm:flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search items..."
            className="w-full rounded-[var(--radius-md)] border border-border bg-card py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-ring/40"
          />
        </div>
        <Button variant="accent" onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" />
          New Item
        </Button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {filtered.map((item) => {
          const usage = formulasUsing(item.name).length
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setSelectedId(item.id)}
              className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-accent/40"
            >
              <div className="flex items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
                  <Package className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">{item.name}</p>
                  <p className="truncate font-mono text-xs text-muted-foreground">{item.code}</p>
                </div>
                <Badge tone={item.active ? "success" : "neutral"} className="shrink-0">
                  {item.active ? "Active" : "Inactive"}
                </Badge>
              </div>
              <div className="flex items-center justify-between border-t border-border pt-3 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <Tag className="size-3.5" />
                  {item.category}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Layers className="size-3.5" />
                  {usage} formula{usage === 1 ? "" : "s"}
                </span>
              </div>
            </button>
          )
        })}
        {filtered.length === 0 && (
          <div className="col-span-full rounded-xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
            No items match “{query}”.
          </div>
        )}
      </div>

      {/* Detail Drawer */}
      <SidePanel
        open={selected != null}
        onClose={() => setSelectedId(null)}
        title={selected?.name ?? "Item"}
        description={selected?.code}
      >
        {selected && (
          <ItemDetail
            item={selected}
            onEdit={() => {
              setEditing(selected)
              setSelectedId(null)
            }}
            onDelete={() => {
              setDeleting(selected)
              setSelectedId(null)
            }}
          />
        )}
      </SidePanel>

      {/* Create Modal */}
      <ItemFormModal
        open={createOpen}
        mode="create"
        onClose={() => setCreateOpen(false)}
        onSubmit={handleCreate}
      />

      {/* Edit Modal */}
      <ItemFormModal
        open={editing != null}
        mode="edit"
        initial={editing ?? undefined}
        onClose={() => setEditing(null)}
        onSubmit={handleEdit}
      />

      {/* Delete Confirmation Modal */}
      <Modal
        open={deleting != null}
        onClose={() => setDeleting(null)}
        size="sm"
        title="Delete item?"
        description={`“${deleting?.name}” will be removed from this prototype view. This is a mock action — nothing is deleted from a backend.`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDelete}>
              <Trash2 className="size-4" />
              Delete
            </Button>
          </>
        }
      />
    </>
  )
}

function ItemDetail({ item, onEdit, onDelete }: { item: Item; onEdit: () => void; onDelete: () => void }) {
  const usedIn = formulasUsing(item.name)
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="accent">{item.category}</Badge>
        <Badge tone={item.active ? "success" : "neutral"}>{item.active ? "Active" : "Inactive"}</Badge>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <MetaItem icon={Hash} label="Item Code" value={item.code} />
        <MetaItem icon={Ruler} label="Default Unit" value={item.unit} />
        <MetaItem icon={Tag} label="Category" value={item.category} />
        <MetaItem icon={FileText} label="Status" value={item.active ? "Active" : "Inactive"} />
      </div>

      <div>
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Spec / Quality Memo</p>
        <p className="whitespace-pre-line rounded-lg border border-border bg-secondary/30 px-4 py-3 text-sm leading-relaxed text-foreground text-pretty">
          {item.specMemo || "No spec / quality memo recorded."}
        </p>
      </div>

      <div>
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Used in Formulas ({usedIn.length})
        </p>
        {usedIn.length > 0 ? (
          <div className="flex flex-col gap-1.5">
            {usedIn.slice(0, 6).map((f) => (
              <div key={f.id} className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2 text-sm">
                <span className="font-mono text-xs text-muted-foreground">{f.number}</span>
                <span className="truncate text-foreground">{f.item}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Not referenced by any formula yet.</p>
        )}
      </div>

      <div className="flex items-center gap-2 border-t border-border pt-4">
        <Button variant="outline" className="flex-1" onClick={onEdit}>
          <Pencil className="size-4" />
          Edit
        </Button>
        <Button variant="danger" onClick={onDelete}>
          <Trash2 className="size-4" />
          Delete
        </Button>
      </div>
    </div>
  )
}

function ItemFormModal({
  open,
  mode,
  initial,
  onClose,
  onSubmit,
}: {
  open: boolean
  mode: "create" | "edit"
  initial?: Item
  onClose: () => void
  onSubmit: (draft: Draft) => void
}) {
  const [draft, setDraft] = useState<Draft>(emptyDraft)

  // Reset the form whenever the modal opens for a new target.
  const key = `${open}-${initial?.id ?? "new"}`
  const [lastKey, setLastKey] = useState("")
  if (open && key !== lastKey) {
    setLastKey(key)
    setDraft(initial ? { ...initial } : emptyDraft)
  }

  const valid = draft.name.trim().length > 0 && draft.code.trim().length > 0

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mode === "create" ? "New Item" : "Edit Item"}
      description="Prototype form — changes update this view only and are not persisted."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="accent" disabled={!valid} onClick={() => onSubmit(draft)}>
            {mode === "create" ? "Create Item" : "Save Changes"}
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Item Code">
            <Input
              value={draft.code}
              onChange={(e) => setDraft((d) => ({ ...d, code: e.target.value }))}
              placeholder="UCO-001"
            />
          </Field>
          <Field label="Default Unit">
            <Select value={draft.unit} onChange={(e) => setDraft((d) => ({ ...d, unit: e.target.value }))}>
              {unitOptions.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Name">
          <Input
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            placeholder="Used Cooking Oil"
          />
        </Field>
        <Field label="Category">
          <Input
            value={draft.category}
            onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))}
            placeholder="Recovered Oils"
          />
        </Field>
        <Field label="Spec / Quality Memo" hint="Free-text reference copied as the default memo when selected in a formula.">
          <textarea
            value={draft.specMemo}
            onChange={(e) => setDraft((d) => ({ ...d, specMemo: e.target.value }))}
            rows={3}
            placeholder="FFA ≤ 3.5%, Moisture ≤ 1%, ISCC eligible…"
            className="w-full rounded-[var(--radius-md)] border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-ring/40"
          />
        </Field>
        <label className="flex items-center gap-2.5">
          <input
            type="checkbox"
            checked={draft.active}
            onChange={(e) => setDraft((d) => ({ ...d, active: e.target.checked }))}
            className="size-4 rounded border-border text-accent focus:ring-ring/40"
          />
          <span className="text-sm text-foreground">Active</span>
        </label>
      </div>
    </Modal>
  )
}

function MetaItem({ icon: Icon, label, value }: { icon: typeof Ruler; label: string; value: string }) {
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
