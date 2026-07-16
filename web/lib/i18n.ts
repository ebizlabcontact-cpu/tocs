/**
 * TOCS localization helper — TypeScript-only, no framework, no React provider.
 *
 * Works identically in Server Components and Client Components because `t()` is a
 * pure function that reads the static locale dictionary. `en.ts` remains the
 * canonical key catalog and English source-copy contract; `ko.ts` is the active
 * rendered locale.
 *
 * Usage:
 *   t("shell.nav.dashboard")            -> "대시보드"
 *   t("some.count.key", { count: 3 })   -> interpolates {count}
 */
import { en, type EnDictionary } from "@/locales/en"
import { ko } from "@/locales/ko"

/** Active rendered dictionary (Korean). Missing leaves fall back to canonical English. */
const dictionary: LocaleDictionaryShape = ko

type Dictionary = typeof en

/** Leaf values are `string`; nested key structure matches `EnDictionary`. */
export type LocaleDictionaryShape = {
  [K in keyof EnDictionary]?: EnDictionary[K] extends string
    ? string
    : EnDictionary[K] extends Record<string, unknown>
      ? LocaleDictionaryShapeFor<EnDictionary[K]>
      : never
}

type LocaleDictionaryShapeFor<T> = {
  [K in keyof T]?: T[K] extends string
    ? string
    : T[K] extends Record<string, unknown>
      ? LocaleDictionaryShapeFor<T[K]>
      : never
}

/** Values that can be substituted into `{placeholder}` tokens. */
export type TranslationParams = Record<string, string | number>

/**
 * Recursively build the union of dot-notation paths that resolve to a string
 * leaf. Non-string leaves (nested objects) are traversed; empty namespaces
 * contribute no paths, so reserved placeholders never widen the key type.
 */
type DotPaths<T> = {
  [K in Extract<keyof T, string>]: T[K] extends string
    ? K
    : T[K] extends Record<string, unknown>
      ? `${K}.${DotPaths<T[K]>}`
      : never
}[Extract<keyof T, string>]

export type TranslationKey = DotPaths<Dictionary>

/** Walk a dot path through the dictionary. Returns the leaf or undefined. */
function resolvePath(dict: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, part) => {
    if (acc && typeof acc === "object" && part in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[part]
    }
    return undefined
  }, dict)
}

/** Replace `{name}` / `{count}` tokens; unknown tokens are left intact. */
function interpolate(template: string, params: TranslationParams): string {
  return template.replace(/\{(\w+)\}/g, (match, token: string) =>
    token in params ? String(params[token]) : match,
  )
}

/**
 * Resolve a localization key to the active locale string.
 *
 * - Valid key: returns the value (with interpolation applied when params given).
 * - Missing/invalid key: logs a clear error in development and returns the raw
 *   key so the UI stays visible and the problem is obvious during review.
 */
export function t(key: TranslationKey, params?: TranslationParams): string {
  const localizedValue = resolvePath(dictionary, key)
  const fallbackValue = resolvePath(en, key)
  const value = typeof localizedValue === "string" ? localizedValue : fallbackValue

  if (typeof value !== "string") {
    if (process.env.NODE_ENV !== "production") {
      console.error(`[i18n] missing or non-string key "${key}"`)
    }
    return key
  }

  return params ? interpolate(value, params) : value
}
