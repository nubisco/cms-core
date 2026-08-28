/**
 * The `image` field, normalised once instead of in every block.
 *
 * Documents carry an image three ways and all three are live at the same time:
 * a bare string (the legacy shape, and still what an unmigrated document
 * holds), the contract shape `{ src, alt, w, h }`, and delivery's media shape
 * `{ url, alt, width, height }`. A block that re-implements
 * "string-or-object" gets one of them right and drops the alt text of the other
 * two, which is how alt text quietly disappeared from half a site.
 *
 * `alt` may be a `{ $t }` reference like any other localized string, so it is
 * resolved through the message table rather than printed as a key.
 */
import type { FieldValue, ImageValue, TRef } from './contract'
import { text } from './resolve'

export interface ResolvedImage {
  /** '' when nothing is authored, which is the caller's signal to render nothing. */
  src: string
  /** Always a string. '' means decorative, and must still reach the markup as alt="". */
  alt: string
  width?: number
  height?: number
}

const EMPTY: ResolvedImage = { src: '', alt: '' }

function num(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim() && Number.isFinite(Number(v))) return Number(v)
  return undefined
}

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

/**
 * Normalise ANY authored image value. `messages` resolves a `{ $t }` alt;
 * `fallback` is the host's own bundled asset, used only when nothing is
 * authored, so a half-authored document still renders a complete page.
 */
export function normalizeImage(
  value: unknown,
  messages: Record<string, string> = {},
  fallback: string | ResolvedImage = '',
): ResolvedImage {
  const fb: ResolvedImage = typeof fallback === 'string' ? { src: fallback.trim(), alt: '' } : fallback

  if (typeof value === 'string') {
    const src = value.trim()
    return src ? { src, alt: '' } : { ...fb }
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ...fb }

  const o = value as Record<string, unknown> & Partial<ImageValue>
  const src = str(o.src) || str(o.url) || str(o.href)
  if (!src) return { ...fb }

  const rawAlt = o.alt
  const alt =
    typeof rawAlt === 'string'
      ? rawAlt
      : rawAlt && typeof rawAlt === 'object'
        ? text(rawAlt as TRef, messages)
        : ''

  return {
    src,
    alt,
    width: num(o.w) ?? num(o.width),
    height: num(o.h) ?? num(o.height),
  }
}

/** Whether a field value is an image the renderer can draw. */
export function hasImage(value: FieldValue | unknown): boolean {
  return !!normalizeImage(value).src
}
