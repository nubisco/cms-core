/**
 * The `video` field, normalised once instead of in every block.
 *
 * Authored as the contract shape `{ src, poster, mobileSrc, label, w, h }`, and
 * accepted in delivery's media spelling too (`url`, `width`, `height`, `mobile`),
 * the way an image is. A bare string is a src with no poster.
 *
 * `label` may be a `{ $t }` reference like any other localized string, so it is
 * resolved through the message table rather than printed as a key.
 */
import type { FieldValue, TRef, VideoValue } from './contract/index.js'
import { text } from './resolve.js'

export interface ResolvedVideo {
  /** '' when nothing is authored, which is the caller's signal to render nothing. */
  src: string
  /** '' when no poster is authored. A video without one is not drawn (hasVideo). */
  poster: string
  mobileSrc?: string
  /** '' means decorative: the renderer hides the video from screen readers. */
  label: string
  width?: number
  height?: number
}

const EMPTY: ResolvedVideo = { src: '', poster: '', label: '' }

function num(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim() && Number.isFinite(Number(v))) return Number(v)
  return undefined
}

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

/** A poster or mobile cut may itself be authored as an image object. */
function url(v: unknown): string {
  if (typeof v === 'string') return v.trim()
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    const o = v as Record<string, unknown>
    return str(o.src) || str(o.url)
  }
  return ''
}

/** Normalise ANY authored video value. `messages` resolves a `{ $t }` label. */
export function normalizeVideo(value: unknown, messages: Record<string, string> = {}): ResolvedVideo {
  if (typeof value === 'string') {
    const src = value.trim()
    return src ? { ...EMPTY, src } : { ...EMPTY }
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ...EMPTY }

  const o = value as Record<string, unknown> & Partial<VideoValue>
  const src = str(o.src) || str(o.url)
  if (!src) return { ...EMPTY }

  const rawLabel = o.label
  const label =
    typeof rawLabel === 'string'
      ? rawLabel
      : rawLabel && typeof rawLabel === 'object'
        ? text(rawLabel as TRef, messages)
        : ''

  const mobileSrc = url(o.mobileSrc) || url(o.mobile)
  return {
    src,
    poster: url(o.poster),
    ...(mobileSrc ? { mobileSrc } : {}),
    label,
    width: num(o.w) ?? num(o.width),
    height: num(o.h) ?? num(o.height),
  }
}

/**
 * Whether a field value is a video the renderer can draw: a file and its
 * poster. The poster is the first paint and what stays under reduced motion,
 * so a video without one is not drawn rather than drawn as an empty box.
 */
export function hasVideo(value: FieldValue | unknown): boolean {
  const v = normalizeVideo(value)
  return !!v.src && !!v.poster
}
