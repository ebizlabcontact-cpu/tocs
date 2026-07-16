/**
 * TOCS localization helper — TypeScript-only, no framework, no React provider.
 *
 * Works identically in Server Components and Client Components because `t()` is a
 * pure function that reads the static `en` dictionary. When Cursor later adds a
 * `ko.ts`, this is the single place that would choose a dictionary; for now the
 * English source in `en.ts` is both the active locale and the fallback.
 *
 * Usage:
 *   t("shell.nav.dashboard")            -> "Dashboard"
 *   t("some.count.key", { count: 3 })   -> interpolates {count}
 */
import { en } from "@/locales/en"

type Dictionary = typeof en

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
 * Resolve a localization key to its English string.
 *
 * - Valid key: returns the value (with interpolation applied when params given).
 * - Missing/invalid key: logs a clear error in development and returns the raw
 *   key so the UI stays visible and the problem is obvious during review.
 */
export function t(key: TranslationKey, params?: TranslationParams): string {
  const value = resolvePath(en, key)

  if (typeof value !== "string") {
    if (process.env.NODE_ENV !== "production") {
      console.error(`[v0] i18n: missing or non-string key "${key}"`)
    }
    return key
  }

  return params ? interpolate(value, params) : value
}
