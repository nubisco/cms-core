/**
 * Content contract: the framework-agnostic shape of Nubisco CMS content.
 *
 * This is the crown jewel of the system. The CMS edits documents of this shape,
 * and any renderer (Vue first, others later) is just a function from these types
 * to a rendered page. Nothing here mentions Vue on purpose.
 *
 * Vocabulary: Fields (primitives) compose into Blocks (placeable units), which
 * are ordered inside Zones on a Page.
 */

// ─── Fields: the primitives ──────────────────────────────────────────────

export type FieldType =
  | 'text'
  | 'richtext'
  | 'number'
  | 'boolean'
  | 'image'
  | 'link'
  | 'color'
  | 'date'
  | 'select'

/** A field's schema: what a Block declares it accepts. */
export interface FieldSchema {
  type: FieldType
  /** Editor-facing label. */
  label: string
  help?: string
  required?: boolean
  /**
   * Whether the value is per-locale. Text/richtext default to true and are
   * stored by reference (see TRef) so Verba owns the translations. Media,
   * numbers, and booleans default to false.
   */
  localized?: boolean
  /** Allowed values for `select`. */
  options?: string[]
  default?: unknown
  /** Max length for text, or max value for number. */
  max?: number
}

// ─── Field values as stored in content JSON ──────────────────────────────

/**
 * A reference to an i18n key. Localized strings are never inlined into content;
 * they resolve from Verba / the site's locale JSON at render time. This keeps
 * Verba authoritative and the content documents small, and it matches how the
 * existing sites already use vue-i18n keys.
 */
export interface TRef {
  $t: string
}

export interface ImageValue {
  src: string
  alt?: TRef
  /** Intrinsic size, when known, to avoid layout shift. */
  w?: number
  h?: number
}

export interface LinkValue {
  href: string
  label?: TRef
  external?: boolean
}

export type FieldValue = TRef | string | number | boolean | ImageValue | LinkValue

// ─── Blocks: placeable units built from Fields ───────────────────────────

export type BlockKind =
  /** Fields only, assembled in the CMS. No app code required. */
  | 'composed'
  /** Backed by an app component (anything with behavior, e.g. a form). */
  | 'coded'

export type BlockCategory = 'content' | 'media' | 'form' | 'layout'

export interface BlockVariation {
  id: string
  label: string
  /** Field values this variation presets (a footer subscribe vs a hero one). */
  presets?: Record<string, FieldValue>
}

/** A named region inside a composed block that nests other blocks. */
export interface SlotSchema {
  label: string
  /** Block types allowed in this slot. Omit to allow any. */
  allow?: string[]
}

/**
 * A block type definition, registered once. The editor catalog, the inspector
 * fields, validation, and serialization all derive from this, mirroring how the
 * NubiscoUI Blueprint system derives everything from a NodeDefinition.
 *
 * Coded blocks map `type` to a real component through a per-framework registry
 * that lives in the renderer package, not in this contract.
 */
export interface BlockDefinition {
  type: string
  label: string
  kind: BlockKind
  category?: BlockCategory
  icon?: string
  fields: Record<string, FieldSchema>
  variations?: BlockVariation[]
  slots?: Record<string, SlotSchema>
}

/** A block as it appears in a content document. */
export interface BlockInstance {
  /** Stable id: survives reorder, used for deep links and in-place edit targeting. */
  id: string
  type: string
  variation?: string
  fields: Record<string, FieldValue>
  /** Visibility logic. Absent means always visible. */
  when?: import('./logic.js').Condition
  /** Nested blocks for composed blocks with slots. */
  slots?: Record<string, BlockInstance[]>
}

// ─── Zones and Pages: the reorder surface ────────────────────────────────

/** An ordered list of blocks. Array order is render order and reorder order. */
export interface Zone {
  blocks: BlockInstance[]
}

export interface PageDocument {
  route: string
  meta?: {
    title?: TRef
    description?: TRef
    /** Page renders its own newsletter, so the footer one is suppressed. */
    ownNewsletter?: boolean
  }
  /** Named zones, usually just `main`. */
  zones: Record<string, Zone>
  /** Whole-page gate, e.g. a product feature flag. */
  when?: import('./logic.js').Condition
  /** Logic graphs referenced by block/page conditions via { kind: 'graph', graphId }. */
  graphs?: Record<string, import('./logic.js').LogicGraph>
}
