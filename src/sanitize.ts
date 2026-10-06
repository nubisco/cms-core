/**
 * Richtext sanitising: authored HTML, reduced to the markup an editor can write.
 *
 * A richtext field is HTML, and a renderer inserts it as HTML (Vue: `v-html`).
 * Anyone who can write a document, an editor or an API token, could otherwise
 * put a script on every page that renders it. So the HTML is REBUILT rather
 * than filtered: the input is read as a stream of tags and text, and the output
 * holds only the tags and attributes on the allowlist, re-emitted with their
 * values escaped, and the text escaped. Nothing the input says verbatim reaches
 * the output except text, so a tag this reader misparses is dropped, never
 * passed through. Comments, doctypes, CDATA, and the contents of script, style
 * and similar elements are removed entirely.
 *
 * URLs in `href` and `src` keep only safe schemes (see `isSafeUrl`).
 *
 * Framework-free and DOM-free on purpose: the same function runs in a browser,
 * in a Node prerender and in a Cloudflare Worker, so the CMS can clean a
 * document when it is saved and a site can clean it again when it renders.
 */

/** Tags an editor can produce, and the attributes each may keep. */
const ALLOWED: Record<string, readonly string[]> = {
  p: [],
  br: [],
  hr: [],
  h2: [],
  h3: [],
  h4: [],
  h5: [],
  h6: [],
  strong: [],
  b: [],
  em: [],
  i: [],
  u: [],
  s: [],
  sub: [],
  sup: [],
  small: [],
  mark: [],
  span: [],
  code: [],
  pre: [],
  blockquote: [],
  ul: [],
  ol: ['start'],
  li: [],
  a: ['href', 'target', 'rel', 'title'],
  figure: [],
  figcaption: [],
  img: ['src', 'alt', 'width', 'height', 'loading'],
  table: [],
  thead: [],
  tbody: [],
  tr: [],
  th: ['colspan', 'rowspan'],
  td: ['colspan', 'rowspan'],
}

/** Attributes any allowed tag may keep. */
const GLOBAL_ATTRS = ['class']

/** Tags with no closing tag. */
const VOID = new Set(['br', 'hr', 'img'])

/** Elements whose CONTENT is dropped along with them, not just the tags. */
const DROP_WITH_CONTENT = new Set([
  'script',
  'style',
  'iframe',
  'object',
  'embed',
  'noscript',
  'template',
  'textarea',
  'title',
  'xmp',
  'noembed',
  'noframes',
  'svg',
  'math',
  'select',
])

const SAFE_SCHEMES = new Set(['http:', 'https:', 'mailto:', 'tel:', 'sms:'])

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  colon: ':',
  tab: '\t',
  newline: '\n',
}

/** Decodes the entities an attribute value can hide a scheme behind. */
function decodeEntities(v: string): string {
  return v.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);?/gi, (m, body: string) => {
    if (body[0] === '#') {
      const code = body[1] === 'x' || body[1] === 'X' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10)
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : ''
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? m
  })
}

/**
 * True when a URL may be rendered: a relative reference (a path, a query, a
 * fragment), or an absolute URL in a safe scheme. Control characters and
 * whitespace are ignored when reading the scheme, the way browsers ignore them,
 * so `java\tscript:` is still read as `javascript:` and refused.
 */
export function isSafeUrl(raw: string): boolean {
  // eslint-disable-next-line no-control-regex
  const v = decodeEntities(raw).replace(/[\u0000- \u007f-\u009f]/g, '')
  if (!v) return true
  // A scheme can hold no '/', '?' or '#', so a colon after one of those (a
  // path like '/a:b') is not a scheme: the reference is relative.
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(v)
  if (!scheme) return true
  return SAFE_SCHEMES.has(`${(scheme[1] ?? '').toLowerCase()}:`)
}

function escapeText(v: string): string {
  return v.replace(/&(?!(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);)/gi, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function escapeAttr(v: string): string {
  return v.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function cleanAttr(name: string, raw: string): string | null {
  const value = decodeEntities(raw)
  if (name === 'href' || name === 'src') return isSafeUrl(value) ? value.trim() : null
  if (name === 'target') return value === '_blank' || value === '_self' ? value : null
  if (name === 'loading') return value === 'lazy' || value === 'eager' ? value : null
  if (name === 'width' || name === 'height' || name === 'colspan' || name === 'rowspan' || name === 'start') {
    return /^\d{1,5}$/.test(value.trim()) ? value.trim() : null
  }
  return value
}

const TAG_NAME_RE = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)/y

/**
 * The tag starting at `start`, or null when the '<' there does not start one.
 * Quoted attribute values may hold '>'. Linear: a quote left open makes the
 * rest of the document read without quotes (`state.quotesBroken`), so no input
 * can make the reader rescan to the end once per '<'.
 */
function readTag(
  html: string,
  start: number,
  state: { quotesBroken: boolean; noCloseFrom: number },
): { end: number; closing: boolean; name: string; rest: string } | null {
  TAG_NAME_RE.lastIndex = start
  const head = TAG_NAME_RE.exec(html)
  if (!head) return null
  const from = start + head[0].length
  if (from >= state.noCloseFrom) return null
  let end = -1
  if (!state.quotesBroken) {
    let quote = ''
    for (let j = from; j < html.length; j++) {
      const c = html[j]
      if (quote) {
        if (c === quote) quote = ''
      } else if (c === '"' || c === "'") quote = c
      else if (c === '>') {
        end = j
        break
      }
    }
    if (end === -1 && quote) state.quotesBroken = true
    else if (end === -1) state.noCloseFrom = from
  }
  if (end === -1 && from < state.noCloseFrom) end = html.indexOf('>', from)
  if (end === -1) {
    // No '>' anywhere after here: no later '<' can start a tag either.
    state.noCloseFrom = Math.min(state.noCloseFrom, from)
    return null
  }
  return { end: end + 1, closing: head[1] === '/', name: (head[2] ?? '').toLowerCase(), rest: html.slice(from, end) }
}

const ATTR_RE = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g

function renderOpenTag(tag: string, attrSource: string): string {
  const allowed = ALLOWED[tag] ?? []
  const kept: [string, string][] = []
  const seen = new Set<string>()
  for (const m of attrSource.matchAll(ATTR_RE)) {
    const name = (m[1] ?? '').toLowerCase()
    if (seen.has(name)) continue
    seen.add(name)
    if (!allowed.includes(name) && !GLOBAL_ATTRS.includes(name)) continue
    const raw = m[2] ?? m[3] ?? m[4] ?? ''
    const value = cleanAttr(name, raw)
    if (value === null) continue
    kept.push([name, value])
  }
  // A link that opens a new tab must not hand the opener to the page it opens.
  if (tag === 'a' && kept.some(([n, v]) => n === 'target' && v === '_blank')) {
    const rel = kept.find(([n]) => n === 'rel')
    if (!rel) kept.push(['rel', 'noopener'])
    else if (!/\bnoopener\b/i.test(rel[1])) rel[1] = `${rel[1]} noopener`.trim()
  }
  return `<${tag}${kept.map(([n, v]) => ` ${n}="${escapeAttr(v)}"`).join('')}>`
}

/**
 * The HTML, with only the markup an editor can write. Safe to insert as HTML.
 * Content that is already clean comes back unchanged apart from attribute
 * quoting (always double quotes) and the order of nothing else.
 */
export function sanitizeRichText(html: string): string {
  if (typeof html !== 'string' || !html) return ''
  let out = ''
  let i = 0
  const open: string[] = []
  const state = { quotesBroken: false, noCloseFrom: Infinity }
  const n = html.length
  while (i < n) {
    const lt = html.indexOf('<', i)
    if (lt === -1) {
      out += escapeText(html.slice(i))
      break
    }
    out += escapeText(html.slice(i, lt))
    i = lt

    // Comments, doctypes, CDATA and processing instructions: dropped whole.
    if (html.startsWith('<!--', i)) {
      const end = html.indexOf('-->', i + 4)
      i = end === -1 ? n : end + 3
      continue
    }
    if (html[i + 1] === '!' || html[i + 1] === '?') {
      const end = html.indexOf('>', i)
      i = end === -1 ? n : end + 1
      continue
    }

    const read = readTag(html, i, state)
    if (!read) {
      // A '<' that does not start a tag is text.
      out += '&lt;'
      i += 1
      continue
    }
    const { closing, name: tag, rest } = read
    i = read.end

    if (DROP_WITH_CONTENT.has(tag)) {
      if (!closing && !/\/\s*$/.test(rest)) {
        const close = new RegExp(`</${tag}\\s*>`, 'gi')
        close.lastIndex = i
        const m = close.exec(html)
        i = m ? m.index + m[0].length : n
      }
      continue
    }
    if (!(tag in ALLOWED)) continue

    if (closing) {
      if (VOID.has(tag)) continue
      const at = open.lastIndexOf(tag)
      if (at === -1) continue
      // Close anything left open inside it, so the output stays well formed.
      while (open.length > at) out += `</${open.pop()}>`
      continue
    }
    out += renderOpenTag(tag, rest.replace(/\/\s*$/, ''))
    if (!VOID.has(tag)) open.push(tag)
  }
  while (open.length) out += `</${open.pop()}>`
  return out
}
