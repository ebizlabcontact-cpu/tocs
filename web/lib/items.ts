/**
 * Item catalog + specification templates.
 * Mock UI data only — no backend, no persistence.
 * Each item carries a spec template that drives the dynamic
 * specification fields shown in the Formula Wizard (Step 1).
 */

export type SpecFieldType = "number" | "text" | "select"

export type ItemSpecField = {
  key: string
  label: string
  type: SpecFieldType
  unit?: string
  placeholder?: string
  options?: string[]
}

export type Item = {
  id: string
  name: string
  category: string
  unit: string
  description: string
  specTemplate: ItemSpecField[]
}

export const items: Item[] = [
  {
    id: "it-uco",
    name: "Used Cooking Oil",
    category: "Recovered Oils",
    unit: "MT",
    description:
      "Collected and filtered used cooking oil destined for biodiesel feedstock and oleochemical processing.",
    specTemplate: [
      { key: "ffa", label: "FFA %", type: "number", unit: "%", placeholder: "e.g. 3.5" },
      { key: "moisture", label: "Moisture %", type: "number", unit: "%", placeholder: "e.g. 0.5" },
      { key: "impurity", label: "Impurity %", type: "number", unit: "%", placeholder: "e.g. 1.0" },
      { key: "origin", label: "Origin", type: "text", placeholder: "e.g. Southeast Asia" },
      {
        key: "color",
        label: "Color",
        type: "select",
        options: ["Light Yellow", "Amber", "Dark Brown", "Black"],
      },
    ],
  },
  {
    id: "it-residue",
    name: "Residue",
    category: "Processing By-products",
    unit: "MT",
    description: "Refining residue and fatty by-products recovered from edible oil processing lines.",
    specTemplate: [
      { key: "ffa", label: "FFA %", type: "number", unit: "%", placeholder: "e.g. 45" },
      { key: "moisture", label: "Moisture %", type: "number", unit: "%", placeholder: "e.g. 1.2" },
      { key: "iv", label: "IV (Iodine Value)", type: "number", placeholder: "e.g. 55" },
      { key: "ash", label: "Ash", type: "number", unit: "%", placeholder: "e.g. 0.3" },
      { key: "density", label: "Density", type: "number", unit: "g/cm³", placeholder: "e.g. 0.91" },
    ],
  },
  {
    id: "it-vegoil",
    name: "Vegetable Oil",
    category: "Edible Oils",
    unit: "MT",
    description: "Refined vegetable oil traded for food-grade and industrial applications.",
    specTemplate: [
      { key: "ffa", label: "FFA %", type: "number", unit: "%", placeholder: "e.g. 0.1" },
      { key: "moisture", label: "Moisture %", type: "number", unit: "%", placeholder: "e.g. 0.05" },
      { key: "iv", label: "IV (Iodine Value)", type: "number", placeholder: "e.g. 110" },
      {
        key: "grade",
        label: "Grade",
        type: "select",
        options: ["Crude", "RBD (Refined)", "Food Grade", "Industrial"],
      },
      { key: "origin", label: "Origin", type: "text", placeholder: "e.g. Malaysia" },
    ],
  },
  {
    id: "it-glucose",
    name: "Glucose",
    category: "Sweeteners",
    unit: "MT",
    description: "Glucose syrup and dextrose products for food, beverage, and fermentation industries.",
    specTemplate: [
      { key: "de", label: "DE (Dextrose Equivalent)", type: "number", placeholder: "e.g. 42" },
      { key: "moisture", label: "Moisture %", type: "number", unit: "%", placeholder: "e.g. 18" },
      { key: "ash", label: "Ash", type: "number", unit: "%", placeholder: "e.g. 0.1" },
      { key: "ph", label: "pH", type: "number", placeholder: "e.g. 4.8" },
      {
        key: "form",
        label: "Form",
        type: "select",
        options: ["Syrup", "Powder", "Crystalline"],
      },
    ],
  },
]

export const unitOptions = ["MT", "KG", "L", "M³", "Drums", "Containers"]

export function getItem(id: string): Item | undefined {
  return items.find((it) => it.id === id)
}

export function getItemByName(name: string): Item | undefined {
  return items.find((it) => it.name === name)
}
