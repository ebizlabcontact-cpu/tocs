"use client"

import { useMemo } from "react"
import { Plus, Trash2, Users } from "lucide-react"
import type { CompanyContact } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Input, Label } from "@/components/ui/field"
import { StatusBadge } from "@/components/ui/badge"

/* ------------------------------------------------------------------ *
 * Company Contacts (P1 Feature 4)
 *
 * Mirrors the `company_contacts` collection. Backend contact CRUD is not
 * shipped (gap G9), so every editing surface is preview-only and never
 * persisted to a backend.
 * ------------------------------------------------------------------ */

let contactSeq = 0
function newContactId(): string {
  contactSeq += 1
  return `contact-${Date.now()}-${contactSeq}`
}

function blankContact(): CompanyContact {
  return { id: newContactId(), name: "", isPrimary: false, isActive: true }
}

const hasAnyValue = (c: CompanyContact): boolean =>
  Boolean(c.name.trim() || c.title || c.phone || c.email || c.branchAddress || c.memo)

/**
 * Cleans a draft contact array before it is persisted to the preview session:
 * drops fully-empty rows, enforces a single primary, and defaults `isActive`.
 */
export function normalizeContacts(contacts: CompanyContact[] | undefined): CompanyContact[] {
  const rows = (contacts ?? []).filter(hasAnyValue)
  let primaryClaimed = false
  return rows.map((c) => {
    const isPrimary = Boolean(c.isPrimary) && !primaryClaimed
    if (isPrimary) primaryClaimed = true
    return { ...c, isPrimary, isActive: c.isActive ?? true }
  })
}

/** Name of the primary (or first) contact — synced to `contactPerson`. */
export function primaryContactName(contacts: CompanyContact[] | undefined): string | undefined {
  const rows = normalizeContacts(contacts)
  if (rows.length === 0) return undefined
  return (rows.find((c) => c.isPrimary) ?? rows[0]).name || undefined
}

const emailLooksValid = (email: string): boolean => email.includes("@")

/* ------------------------------ Editor ------------------------------ */

export function CompanyContactsEditor({
  value,
  onChange,
}: {
  value: CompanyContact[]
  onChange: (rows: CompanyContact[]) => void
}) {
  // When there are no contacts yet, show a single empty row to edit (spec 4.12).
  const fallback = useMemo(() => blankContact(), [])
  const rows = value.length > 0 ? value : [fallback]

  const commit = (next: CompanyContact[]) => onChange(next)

  const update = (id: string, patch: Partial<CompanyContact>) => {
    let next = rows.map((c) => (c.id === id ? { ...c, ...patch } : c))
    // Enforce a single primary across the collection.
    if (patch.isPrimary === true) {
      next = next.map((c) => ({ ...c, isPrimary: c.id === id }))
    }
    commit(next)
  }

  const addRow = () => commit([...rows, blankContact()])
  const removeRow = (id: string) => commit(rows.filter((c) => c.id !== id))

  return (
    <div>
      <div className="mb-2 flex items-start justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Contacts</p>
        <Button variant="outline" size="sm" onClick={addRow} type="button">
          <Plus className="size-4" />
          Add contact
        </Button>
      </div>
      <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
        Mirrors the <code className="text-[10px]">company_contacts</code> collection. Backend contact CRUD not shipped
        (G9) — preview only.
      </p>

      <div>
        {rows.map((contact) => {
          const nameError =
            !contact.name.trim() && hasAnyValue(contact) ? "Contact name is required." : undefined
          const emailError =
            contact.email && !emailLooksValid(contact.email) ? "Enter a valid email address." : undefined
          return (
            <div key={contact.id} className="mb-3 rounded-lg border border-border p-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Label>Contact Name</Label>
                  <Input
                    value={contact.name}
                    onChange={(e) => update(contact.id, { name: e.target.value })}
                    placeholder="Ji-woo Han"
                    aria-invalid={Boolean(nameError)}
                  />
                  {nameError && <p className="mt-1 text-xs text-danger">{nameError}</p>}
                </div>
                <div>
                  <Label>Title</Label>
                  <Input
                    value={contact.title ?? ""}
                    onChange={(e) => update(contact.id, { title: e.target.value })}
                    placeholder="Global Sourcing Manager"
                  />
                </div>
                <div>
                  <Label>Phone</Label>
                  <Input
                    value={contact.phone ?? ""}
                    onChange={(e) => update(contact.id, { phone: e.target.value })}
                    placeholder="02-0000-0000"
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={contact.email ?? ""}
                    onChange={(e) => update(contact.id, { email: e.target.value })}
                    placeholder="name@company.com"
                    aria-invalid={Boolean(emailError)}
                  />
                  {emailError && <p className="mt-1 text-xs text-danger">{emailError}</p>}
                </div>
                <div className="sm:col-span-2">
                  <Label>Branch Address</Label>
                  <Input
                    value={contact.branchAddress ?? ""}
                    onChange={(e) => update(contact.id, { branchAddress: e.target.value })}
                    placeholder="District 1, Ho Chi Minh City"
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label>Memo</Label>
                  <Input
                    value={contact.memo ?? ""}
                    onChange={(e) => update(contact.id, { memo: e.target.value })}
                    placeholder="Internal note about this contact"
                  />
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-4">
                  <label className="flex items-center gap-2 text-sm text-foreground">
                    <input
                      type="checkbox"
                      className="size-4 rounded border-border text-accent focus:ring-2 focus:ring-ring/40"
                      checked={Boolean(contact.isPrimary)}
                      onChange={(e) => update(contact.id, { isPrimary: e.target.checked })}
                    />
                    Primary contact
                  </label>
                  <label className="flex items-center gap-2 text-sm text-foreground">
                    <input
                      type="checkbox"
                      className="size-4 rounded border-border text-accent focus:ring-2 focus:ring-ring/40"
                      checked={contact.isActive ?? true}
                      onChange={(e) => update(contact.id, { isActive: e.target.checked })}
                    />
                    Active
                  </label>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  type="button"
                  className="text-danger"
                  disabled={rows.length <= 1}
                  onClick={() => removeRow(contact.id)}
                >
                  <Trash2 className="size-4" />
                  Remove
                </Button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* --------------------------- Read-only table --------------------------- */

export function CompanyContactsReadOnlyTable({ contacts }: { contacts?: CompanyContact[] }) {
  const rows = contacts ?? []

  return (
    <div>
      <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Users className="size-3.5" />
        Contacts
      </p>
      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-sm text-muted-foreground">
          No contacts registered — add via Edit.
        </p>
      ) : (
        <>
          {/* Card view (mobile) */}
          <div className="grid gap-2 sm:hidden">
            {rows.map((c) => (
              <div key={c.id} className="rounded-lg border border-border bg-card p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-foreground">{c.name}</span>
                  <div className="flex items-center gap-1.5">
                    {c.isPrimary && <StatusBadge tone="accent">Primary</StatusBadge>}
                    <StatusBadge tone={c.isActive === false ? "neutral" : "success"}>
                      {c.isActive === false ? "Inactive" : "Active"}
                    </StatusBadge>
                  </div>
                </div>
                {c.title && <p className="mt-1 text-xs text-muted-foreground">{c.title}</p>}
                <dl className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                  {c.phone && <div>{c.phone}</div>}
                  {c.email && <div className="truncate">{c.email}</div>}
                </dl>
              </div>
            ))}
          </div>

          {/* Table view (sm+) */}
          <div className="hidden overflow-x-auto rounded-lg border border-border sm:block">
            <table className="w-full min-w-[640px] text-sm">
              <caption className="sr-only">Company contacts</caption>
              <thead className="bg-secondary/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th scope="col" className="px-3 py-2.5 font-medium">Name</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Title</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Phone</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Email</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Primary</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Active</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((c) => (
                  <tr key={c.id} className="bg-card">
                    <td className="px-3 py-3 font-medium text-foreground">{c.name}</td>
                    <td className="px-3 py-3 text-muted-foreground">{c.title || "—"}</td>
                    <td className="px-3 py-3 text-muted-foreground">{c.phone || "—"}</td>
                    <td className="max-w-[220px] truncate px-3 py-3 text-muted-foreground" title={c.email || undefined}>
                      {c.email || "—"}
                    </td>
                    <td className="px-3 py-3">
                      {c.isPrimary ? <StatusBadge tone="accent">Primary</StatusBadge> : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-3 py-3">
                      <StatusBadge tone={c.isActive === false ? "neutral" : "success"}>
                        {c.isActive === false ? "Inactive" : "Active"}
                      </StatusBadge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
