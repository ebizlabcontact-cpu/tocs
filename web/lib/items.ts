/**
 * Registered item master data.
 * Mock UI data only — no backend, no persistence.
 *
 * V1 rule: items carry only a free-text Spec / Quality Memo.
 * Structured item specification templates are deferred to V2, because
 * each item category has different quality/spec criteria.
 */

export type Item = {
  id: string
  code: string
  name: string
  category: string
  /** Default unit applied when the item is selected in a formula. */
  unit: string
  active: boolean
  /** Free-text spec / quality memo — no structured fields. */
  specMemo: string
}

export const items: Item[] = [
  {
    id: "it-uco",
    code: "UCO-001",
    name: "Used Cooking Oil",
    category: "Recovered Oils",
    unit: "MT",
    active: true,
    specMemo: "FFA ≤ 3.5%, Moisture ≤ 1%, Impurity ≤ 0.5%, ISCC eligible, Vietnam origin",
  },
  {
    id: "it-residue",
    code: "RES-002",
    name: "Residue",
    category: "Processing By-products",
    unit: "MT",
    active: true,
    specMemo: "FFA 40–50%, Moisture ≤ 1.5%, IV ~55, refining residue from edible oil lines",
  },
  {
    id: "it-vegoil",
    code: "VEG-003",
    name: "Vegetable Oil",
    category: "Edible Oils",
    unit: "MT",
    active: true,
    specMemo: "RBD grade, FFA ≤ 0.1%, Moisture ≤ 0.05%, IV ~110, Malaysia origin",
  },
  {
    id: "it-glucose",
    code: "GLU-004",
    name: "Glucose",
    category: "Sweeteners",
    unit: "MT",
    active: true,
    specMemo: "DE 42, Moisture ~18%, Ash ≤ 0.1%, pH 4.8, syrup form for food & fermentation",
  },
]

export const unitOptions = ["MT", "KG", "L", "M³", "Drums", "Containers"]

export function getItem(id: string): Item | undefined {
  return items.find((it) => it.id === id)
}

export function getItemByName(name: string): Item | undefined {
  return items.find((it) => it.name === name)
}
