import type { FieldValue, ImageValue, LinkValue, TRef } from './contract'

export function isTRef(v: unknown): v is TRef {
  return typeof v === 'object' && v !== null && '$t' in v
}

export function isImage(v: unknown): v is ImageValue {
  return typeof v === 'object' && v !== null && 'src' in v
}

export function isLink(v: unknown): v is LinkValue {
  return typeof v === 'object' && v !== null && 'href' in v
}

/**
 * Resolves a field value to display text. String refs ({ $t }) resolve from the
 * provided message table (Verba / locale JSON), falling back to the key so a
 * missing translation is visible rather than blank.
 */
export function text(value: FieldValue | undefined, messages: Record<string, string>): string {
  if (value == null) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (isTRef(value)) return messages[value.$t] ?? value.$t
  return ''
}
