/**
 * Richtext: authored HTML, and the one hook a product needs to style it.
 *
 * The CMS stores a richtext field as HTML written by an editor. A renderer
 * inserts it (Vue: `v-html`), which is why two things live here rather than in
 * each product's blocks:
 *
 *  1. `compileLinks`, because inserted markup is NOT compiled. A document that
 *     authored `<router-link to="/x">` would otherwise render the literal
 *     element and vanish; it becomes a real `<a href>`, and CmsRichText's
 *     delegated click handler gives it SPA navigation. A `router-link` with no
 *     destination becomes a `<span>`: the label renders, never a dead anchor,
 *     the same rule the link field enforces everywhere else.
 *
 *  2. `applySerializers`, the equivalent of Prismic's rich text serializers. A
 *     product styles its own headings, paragraphs and quotes by naming a class
 *     (or rewriting the tag) per node type, instead of forking the component.
 *
 * WHAT A SERIALIZER CAN DO, precisely: it rewrites an element's OPEN TAG (its
 * tag name, its classes, its attributes). The children are passed through
 * untouched, and a renamed tag has its matching close tag renamed with it. It
 * cannot restructure a subtree (wrapping a blockquote's text in an extra
 * paragraph, say) because the input is HTML rather than a node tree. A product
 * that needs that keeps its own transform and passes the result in as `html`.
 */

export type RichTextNodeType =
  | 'paragraph'
  | 'heading1'
  | 'heading2'
  | 'heading3'
  | 'heading4'
  | 'heading5'
  | 'heading6'
  | 'list'
  | 'oList'
  | 'listItem'
  | 'quote'
  | 'preformatted'
  | 'code'
  | 'hyperlink'
  | 'image'
  | 'strong'
  | 'em'
  | 'span'
  | 'break'
  | 'table'
  | 'row'
  | 'cell'
  | 'other'

const TYPE_BY_TAG: Record<string, RichTextNodeType> = {
  p: 'paragraph',
  h1: 'heading1',
  h2: 'heading2',
  h3: 'heading3',
  h4: 'heading4',
  h5: 'heading5',
  h6: 'heading6',
  ul: 'list',
  ol: 'oList',
  li: 'listItem',
  blockquote: 'quote',
  pre: 'preformatted',
  code: 'code',
  a: 'hyperlink',
  img: 'image',
  strong: 'strong',
  b: 'strong',
  em: 'em',
  i: 'em',
  span: 'span',
  br: 'break',
  table: 'table',
  tr: 'row',
  td: 'cell',
  th: 'cell',
}

/** The node a serializer is handed. `attrs` are the authored attributes, as written. */
export interface RichTextNode {
  type: RichTextNodeType
  /** The authored tag name, lowercased. */
  tag: string
  attrs: Record<string, string>
}

/** What a serializer may return. Returning nothing leaves the element alone. */
export interface RichTextRewrite {
  /** Render as a different element. The matching close tag is renamed too. */
  tag?: string
  /** Classes to ADD to whatever the element already carries. */
  class?: string
  /** Attributes to set (or, with an empty string, to leave as-is). */
  attrs?: Record<string, string>
}

/**
 * A serializer for one node type. The string form is the common case: classes
 * to add. The function form returns a rewrite, or a raw open tag if a product
 * wants full control (its close tag then keeps the authored tag name).
 */
export type RichTextSerializer = string | ((node: RichTextNode) => RichTextRewrite | string | void)

export type RichTextSerializers = Partial<Record<RichTextNodeType, RichTextSerializer>>

// Both spellings Vue accepts (`RouterLink` / `router-link`) and both binding
// forms (`to` / `:to`) are read, because a document authored either way must not
// silently lose its link.
const ROUTER_LINK_OPEN = /<router-?link\b([^>]*)>/gi
const ROUTER_LINK_CLOSE = /<\/router-?link\s*>/gi
const TO_ATTR = /\s:?to\s*=\s*("([^"]*)"|'([^']*)')/i
const ROUTER_LINK_ANY = /<\/?router-?link\b/i

/**
 * Turn authored `<router-link>` into a real anchor (or an inert span).
 *
 * The close tag is matched to what the OPEN tag became, so a destination-less
 * link closes `</span>` and not `</a>`: emitting the wrong closer leaves the
 * span open and the browser swallows the rest of the paragraph into it.
 */
export function compileLinks(html: string): string {
  if (!ROUTER_LINK_ANY.test(html)) return html
  const closers: string[] = []
  return html
    .replace(ROUTER_LINK_OPEN, (_m, attrs: string) => {
      const m = TO_ATTR.exec(attrs)
      const to = unquote((m?.[2] ?? m?.[3] ?? '').trim())
      const rest = attrs.replace(TO_ATTR, '')
      // No destination authored: render the label, never a dead anchor.
      const tag = to ? 'a' : 'span'
      closers.push(tag)
      return to ? `<a href="${escapeAttr(to)}"${rest}>` : `<span${rest}>`
    })
    .replace(ROUTER_LINK_CLOSE, () => `</${closers.shift() ?? 'a'}>`)
}

/** `:to="'/x'"` binds a string literal, so the inner quotes are not part of the route. */
function unquote(v: string): string {
  const q = v.slice(0, 1)
  return (q === "'" || q === '"') && v.endsWith(q) && v.length > 1 ? v.slice(1, -1).trim() : v
}

function escapeAttr(v: string): string {
  return v.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** Elements with no closing tag, so the stack must not wait for one. */
const VOID = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
])

const TAG_RE = /<(\/?)([a-zA-Z][\w:-]*)((?:"[^"]*"|'[^']*'|[^'">])*?)(\/?)>/g
const ATTR_RE = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g

function parseAttrs(raw: string): Record<string, string> {
  const out: Record<string, string> = {}
  ATTR_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = ATTR_RE.exec(raw))) {
    const name = m[1]
    if (!name) continue
    out[name] = m[2] ?? m[3] ?? m[4] ?? ''
  }
  return out
}

function renderAttrs(attrs: Record<string, string>): string {
  return Object.entries(attrs)
    .map(([k, v]) => (v === '' ? ` ${k}` : ` ${k}="${escapeAttr(v)}"`))
    .join('')
}

/** The node type a tag maps to, so serializers are named by meaning, not by tag. */
export function nodeTypeOf(tag: string): RichTextNodeType {
  return TYPE_BY_TAG[tag.toLowerCase()] ?? 'other'
}

/**
 * Apply serializers to authored HTML.
 *
 * A single pass over the tags, keeping a stack of open elements, so a renamed
 * tag's close tag is renamed with it and nesting is never guessed at. Text
 * between tags is passed through byte for byte: nothing here rewrites content.
 */
export function applySerializers(html: string, serializers?: RichTextSerializers): string {
  if (!serializers || !html) return html
  const stack: { tag: string; as: string }[] = []
  let out = ''
  let last = 0
  TAG_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = TAG_RE.exec(html))) {
    const [full, slash, rawTag, rawAttrs = '', selfClose] = m
    // The tag group is not optional in TAG_RE, but `noUncheckedIndexedAccess`
    // types every capture as possibly undefined. A match with no tag name is not
    // markup this can rewrite, so leave it exactly as authored.
    if (rawTag === undefined) {
      out += full
      continue
    }
    out += html.slice(last, m.index)
    last = m.index + full.length
    const tag = rawTag.toLowerCase()

    if (slash) {
      // Find the innermost matching open element, so a stray close tag in the
      // authored HTML cannot desynchronise the rest of the document.
      let i = stack.length - 1
      while (i >= 0 && stack[i]?.tag !== tag) i--
      const open = i >= 0 ? stack[i] : undefined
      if (open) {
        const as = open.as
        stack.length = i
        out += `</${as}>`
      } else {
        out += full
      }
      continue
    }

    const type = nodeTypeOf(tag)
    const rule = serializers[type]
    const attrs = parseAttrs(rawAttrs)
    const empty = VOID.has(tag) || !!selfClose

    if (!rule) {
      out += full
      if (!empty) stack.push({ tag, as: tag })
      continue
    }

    const result = typeof rule === 'string' ? { class: rule } : rule({ type, tag, attrs })

    if (typeof result === 'string') {
      // Raw open tag: the product owns it entirely. The close tag keeps the
      // authored name, which is what a class-only or attribute-only rewrite
      // spelled by hand needs.
      out += result
      if (!empty) stack.push({ tag, as: tag })
      continue
    }

    const as = (result?.tag ?? tag).toLowerCase()
    const next: Record<string, string> = { ...attrs, ...(result?.attrs ?? {}) }
    if (result?.class) next.class = [attrs.class, result.class].filter(Boolean).join(' ')
    out += `<${as}${renderAttrs(next)}${empty && !VOID.has(as) ? ' /' : ''}>`
    if (!empty) stack.push({ tag, as })
  }
  out += html.slice(last)
  return out
}

/** Whether an authored value carries markup, or is one plain paragraph of text. */
export function isHtml(value: string): boolean {
  return /<[a-z][\s\S]*>/i.test(value)
}
