"use client"

import { useMemo, useState, type ReactNode } from "react"
import { Building2, Search, Plus, Pencil, Trash2, Archive, ArchiveRestore, Layers, Briefcase } from "lucide-react"
import { registeredCompanies, formulas } from "@/lib/mock-data"
import type { RegisteredCompany } from "@/lib/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Modal } from "@/components/ui/modal"
import { SidePanel } from "@/components/ui/side-panel"
import { Field, Input, Select } from "@/components/ui/field"
import { uid } from "@/lib/utils"

type Draft = Omit<RegisteredCompany, "id">

const natureOptions = [
  "Manufacturer",
  "Distributor",
  "Trading Company",
  "Logistics",
  "Logistics Company",
  "Supplier",
  "Buyer",
  "Financier",
]

const countryOptions = [
  "Korea",
  "China",
  "Vietnam",
  "Malaysia",
  "Indonesia",
  "Singapore",
  "Japan",
  "Netherlands",
  "United States",
  "Germany",
]

const currencyOptions = ["KRW", "USD", "EUR", "JPY", "CNY", "SGD"]
const taxTypeOptions = ["General", "Simplified", "Exempt", "Zero-rated"]

const emptyDraft: Draft = {
  name: "",
  nature: "Manufacturer",
  status: "active",
  englishName: "",
  country: "Korea",
  businessRegNo: "",
  corporateRegNo: "",
  taxType: "General",
  contactPerson: "",
  department: "",
  position: "",
  phone: "",
  mobile: "",
  email: "",
  zipCode: "",
  address: "",
  addressDetail: "",
  defaultCurrency: "KRW",
  memo: "",
  tags: [],
}

/** Formulas that reference a company as a participant (Formula-derived usage). */
function formulasUsing(name: string) {
  return formulas.filter((f) => f.participants.some((p) => p.company === name))
}

export function CompaniesExplorer() {
  // Mock local state only — no persistence, no backend.
  const [list, setList] = useState<RegisteredCompany[]>(registeredCompanies)
  const [query, setQuery] = useState("")
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<RegisteredCompany | null>(null)
  const [confirm, setConfirm] = useState<{ company: RegisteredCompany; mode: "archive" | "delete" } | null>(null)

  const filtered = useMemo(
    () =>
      list.filter(
        (c) =>
          c.name.toLowerCase().includes(query.trim().toLowerCase()) ||
          c.nature.toLowerCase().includes(query.trim().toLowerCase()),
      ),
    [list, query],
  )

  const selected = list.find((c) => c.id === selectedId) ?? null

  function handleCreate(draft: Draft) {
    setList((prev) => [{ ...draft, id: uid() }, ...prev])
    setCreateOpen(false)
  }

  function handleEdit(draft: Draft) {
    if (!editing) return
    setList((prev) => prev.map((c) => (c.id === editing.id ? { ...c, ...draft } : c)))
    setEditing(null)
  }

  function handleConfirm() {
    if (!confirm) return
    if (confirm.mode === "delete") {
      setList((prev) => prev.filter((c) => c.id !== confirm.company.id))
      if (selectedId === confirm.company.id) setSelectedId(null)
    } else {
      // Archive toggles active <-> inactive.
      const next = confirm.company.status === "active" ? "inactive" : "active"
      setList((prev) => prev.map((c) => (c.id === confirm.company.id ? { ...c, status: next } : c)))
    }
    setConfirm(null)
  }

  const archiving = confirm?.mode === "archive"
  const willReactivate = archiving && confirm?.company.status === "inactive"

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative sm:max-w-xs sm:flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search trade companies..."
            className="w-full rounded-[var(--radius-md)] border border-border bg-card py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-ring/40"
          />
        </div>
        <Button variant="accent" onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" />
          New Company
        </Button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {filtered.map((company) => {
          const usage = formulasUsing(company.name).length
          return (
            <button
              key={company.id}
              type="button"
              onClick={() => setSelectedId(company.id)}
              className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-accent/40"
            >
              <div className="flex items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
                  <Building2 className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">{company.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{company.nature}</p>
                </div>
                <Badge tone={company.status === "active" ? "success" : "neutral"} className="shrink-0">
                  {company.status === "active" ? "Active" : "Archived"}
                </Badge>
              </div>
              <div className="flex items-center justify-between border-t border-border pt-3 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <Briefcase className="size-3.5" />
                  {company.nature}
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
            No companies match “{query}”.
          </div>
        )}
      </div>

      {/* Detail Drawer */}
      <SidePanel
        open={selected != null}
        onClose={() => setSelectedId(null)}
        title={selected?.name ?? "Company"}
        description={selected?.nature}
      >
        {selected && (
          <CompanyDetail
            company={selected}
            onEdit={() => {
              setEditing(selected)
              setSelectedId(null)
            }}
            onArchive={() => {
              setConfirm({ company: selected, mode: "archive" })
              setSelectedId(null)
            }}
            onDelete={() => {
              setConfirm({ company: selected, mode: "delete" })
              setSelectedId(null)
            }}
          />
        )}
      </SidePanel>

      {/* Create Modal */}
      <CompanyFormModal open={createOpen} mode="create" onClose={() => setCreateOpen(false)} onSubmit={handleCreate} />

      {/* Edit Modal */}
      <CompanyFormModal
        open={editing != null}
        mode="edit"
        initial={editing ?? undefined}
        onClose={() => setEditing(null)}
        onSubmit={handleEdit}
      />

      {/* Archive / Delete Confirmation Modal */}
      <Modal
        open={confirm != null}
        onClose={() => setConfirm(null)}
        size="sm"
        title={archiving ? (willReactivate ? "Reactivate company?" : "Archive company?") : "Delete company?"}
        description={
          archiving
            ? willReactivate
              ? `“${confirm?.company.name}” will be marked active again. Mock action — nothing is persisted.`
              : `“${confirm?.company.name}” will be marked archived (inactive). Mock action — nothing is persisted.`
            : `“${confirm?.company.name}” will be removed from this prototype view. Mock action — nothing is deleted from a backend.`
        }
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(null)}>
              Cancel
            </Button>
            {archiving ? (
              <Button variant="default" onClick={handleConfirm}>
                {willReactivate ? <ArchiveRestore className="size-4" /> : <Archive className="size-4" />}
                {willReactivate ? "Reactivate" : "Archive"}
              </Button>
            ) : (
              <Button variant="danger" onClick={handleConfirm}>
                <Trash2 className="size-4" />
                Delete
              </Button>
            )}
          </>
        }
      />
    </>
  )
}

function CompanyDetail({
  company,
  onEdit,
  onArchive,
  onDelete,
}: {
  company: RegisteredCompany
  onEdit: () => void
  onArchive: () => void
  onDelete: () => void
}) {
  const usedIn = formulasUsing(company.name)
  const archived = company.status !== "active"
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="accent">{company.nature}</Badge>
        <Badge tone={archived ? "neutral" : "success"}>{archived ? "Archived" : "Active"}</Badge>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <MetaItem icon={Briefcase} label="Trade Nature" value={company.nature} />
        <MetaItem icon={Building2} label="Status" value={archived ? "Archived" : "Active"} />
      </div>

      {(company.tags ?? []).length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {company.tags!.map((t) => (
            <Badge key={t} tone="outline">
              {t}
            </Badge>
          ))}
        </div>
      )}

      <p className="rounded-lg border border-border bg-secondary/30 px-4 py-3 text-xs leading-relaxed text-muted-foreground text-pretty">
        Trade nature is a Company Master attribute and a default hint only — a company&apos;s operational role (supplier,
        buyer, carrier, financial, other) is defined per formula in the trade chain.
      </p>

      <DetailGroup
        title="Basic"
        rows={[
          ["English Name", company.englishName],
          ["Country", company.country],
          ["Default Currency", company.defaultCurrency],
        ]}
      />
      <DetailGroup
        title="Registration"
        rows={[
          ["Business Reg. No.", company.businessRegNo],
          ["Corporate Reg. No.", company.corporateRegNo],
          ["Tax Type", company.taxType],
        ]}
      />
      <DetailGroup
        title="Contact"
        rows={[
          ["Contact Person", company.contactPerson],
          ["Department", company.department],
          ["Position", company.position],
          ["Phone", company.phone],
          ["Mobile", company.mobile],
          ["Email", company.email],
        ]}
      />
      <DetailGroup
        title="Address"
        rows={[
          ["ZIP Code", company.zipCode],
          ["Address", company.address],
          ["Detail", company.addressDetail],
        ]}
      />
      {company.memo && (
        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Memo</p>
          <p className="whitespace-pre-line rounded-lg border border-border bg-secondary/30 px-3 py-2 text-sm leading-relaxed text-foreground text-pretty">
            {company.memo}
          </p>
        </div>
      )}

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
        <Button variant="subtle" onClick={onArchive}>
          {archived ? <ArchiveRestore className="size-4" /> : <Archive className="size-4" />}
          {archived ? "Reactivate" : "Archive"}
        </Button>
        <Button variant="danger" onClick={onDelete}>
          <Trash2 className="size-4" />
          Delete
        </Button>
      </div>
    </div>
  )
}

function CompanyFormModal({
  open,
  mode,
  initial,
  onClose,
  onSubmit,
}: {
  open: boolean
  mode: "create" | "edit"
  initial?: RegisteredCompany
  onClose: () => void
  onSubmit: (draft: Draft) => void
}) {
  const [draft, setDraft] = useState<Draft>(emptyDraft)

  const key = `${open}-${initial?.id ?? "new"}`
  const [lastKey, setLastKey] = useState("")
  if (open && key !== lastKey) {
    setLastKey(key)
    if (initial) {
      const { id: _id, ...rest } = initial
      setDraft({ ...emptyDraft, ...rest })
    } else {
      setDraft(emptyDraft)
    }
  }

  const patch = (p: Partial<Draft>) => setDraft((d) => ({ ...d, ...p }))
  const valid = draft.name.trim().length > 0

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={mode === "create" ? "New Company" : "Edit Company"}
      description="Company Master — prototype form. Changes update this view only and are not persisted."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="accent" disabled={!valid} onClick={() => onSubmit(draft)}>
            {mode === "create" ? "Create Company" : "Save Changes"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-6">
        {/* Basic */}
        <FormSection title="Basic">
          <Field label="Company Name" className="sm:col-span-2">
            <Input value={draft.name} onChange={(e) => patch({ name: e.target.value })} placeholder="CJ CheilJedang" />
          </Field>
          <Field label="English Name">
            <Input value={draft.englishName ?? ""} onChange={(e) => patch({ englishName: e.target.value })} placeholder="CJ CheilJedang Corp." />
          </Field>
          <Field label="Country">
            <Select value={draft.country ?? ""} onChange={(e) => patch({ country: e.target.value })}>
              <option value="">Select country…</option>
              {countryOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Trade Nature" hint="Company Master attribute — operational role is set per formula.">
            <Select value={draft.nature} onChange={(e) => patch({ nature: e.target.value })}>
              {natureOptions.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Status">
            <Select value={draft.status} onChange={(e) => patch({ status: e.target.value as RegisteredCompany["status"] })}>
              <option value="active">Active</option>
              <option value="inactive">Archived</option>
            </Select>
          </Field>
        </FormSection>

        {/* Registration */}
        <FormSection title="Registration">
          <Field label="Business Registration Number">
            <Input value={draft.businessRegNo ?? ""} onChange={(e) => patch({ businessRegNo: e.target.value })} placeholder="104-86-00121" />
          </Field>
          <Field label="Corporate Registration Number">
            <Input value={draft.corporateRegNo ?? ""} onChange={(e) => patch({ corporateRegNo: e.target.value })} placeholder="110111-0012345" />
          </Field>
          <Field label="Tax Type">
            <Select value={draft.taxType ?? ""} onChange={(e) => patch({ taxType: e.target.value })}>
              <option value="">Select…</option>
              {taxTypeOptions.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </Field>
        </FormSection>

        {/* Contact */}
        <FormSection title="Contact">
          <Field label="Contact Person">
            <Input value={draft.contactPerson ?? ""} onChange={(e) => patch({ contactPerson: e.target.value })} />
          </Field>
          <Field label="Department">
            <Input value={draft.department ?? ""} onChange={(e) => patch({ department: e.target.value })} />
          </Field>
          <Field label="Position">
            <Input value={draft.position ?? ""} onChange={(e) => patch({ position: e.target.value })} />
          </Field>
          <Field label="Phone">
            <Input value={draft.phone ?? ""} onChange={(e) => patch({ phone: e.target.value })} placeholder="02-0000-0000" />
          </Field>
          <Field label="Mobile">
            <Input value={draft.mobile ?? ""} onChange={(e) => patch({ mobile: e.target.value })} placeholder="010-0000-0000" />
          </Field>
          <Field label="Email">
            <Input type="email" value={draft.email ?? ""} onChange={(e) => patch({ email: e.target.value })} placeholder="name@company.com" />
          </Field>
        </FormSection>

        {/* Address */}
        <FormSection title="Address">
          <Field label="ZIP Code">
            <Input value={draft.zipCode ?? ""} onChange={(e) => patch({ zipCode: e.target.value })} placeholder="04560" />
          </Field>
          <Field label="Address" className="sm:col-span-2">
            <Input value={draft.address ?? ""} onChange={(e) => patch({ address: e.target.value })} placeholder="330 Dongho-ro, Jung-gu, Seoul" />
          </Field>
          <Field label="Detailed Address" className="sm:col-span-2">
            <Input value={draft.addressDetail ?? ""} onChange={(e) => patch({ addressDetail: e.target.value })} placeholder="Building, floor, suite" />
          </Field>
        </FormSection>

        {/* Additional */}
        <FormSection title="Additional">
          <Field label="Default Currency">
            <Select value={draft.defaultCurrency ?? ""} onChange={(e) => patch({ defaultCurrency: e.target.value })}>
              {currencyOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Tags" hint="Comma-separated." className="sm:col-span-2">
            <Input
              value={(draft.tags ?? []).join(", ")}
              onChange={(e) => patch({ tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean) })}
              placeholder="ISCC, Priority"
            />
          </Field>
          <Field label="Memo" className="sm:col-span-2">
            <textarea
              value={draft.memo ?? ""}
              onChange={(e) => patch({ memo: e.target.value })}
              rows={2}
              className="w-full rounded-[var(--radius-md)] border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none focus:ring-2 focus:ring-ring/40"
              placeholder="Internal notes about this company…"
            />
          </Field>
        </FormSection>
      </div>
    </Modal>
  )
}

function DetailGroup({ title, rows }: { title: string; rows: [string, string | undefined][] }) {
  const present = rows.filter(([, v]) => v && v.trim().length > 0)
  if (present.length === 0) return null
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      <div className="rounded-lg border border-border bg-card px-3">
        {present.map(([label, value], i) => (
          <div
            key={label}
            className={
              "flex items-center justify-between gap-3 py-2.5 text-sm" +
              (i < present.length - 1 ? " border-b border-border" : "")
            }
          >
            <span className="text-muted-foreground">{label}</span>
            <span className="min-w-0 truncate text-right font-medium text-foreground">{value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </div>
  )
}

function MetaItem({ icon: Icon, label, value }: { icon: typeof Briefcase; label: string; value: string }) {
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
