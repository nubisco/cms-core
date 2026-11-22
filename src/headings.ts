/**
 * Heading ids, so a heading inside authored richtext can be linked to.
 *
 * The sanitiser keeps no attributes on headings: an `id` an editor types is
 * dropped on save and on render, so `/privacy#installed-apps` opened the policy
 * at the top. Rather than trust authored ids, every h2 to h6 gets one derived
 * from its own text, the way documentation generators do it, so a link target
 * exists for every heading on every page and no editor has to think about it.
 *
 * The id is the heading's text, lowercased, with accents and tags removed, a
 * leading ordinal ("7." or "7.2)") dropped so renumbering a policy does not move
 * its anchors, and every run of anything other than a letter or digit collapsed
 * to one hyphen. A second heading with the same text gets "-2", a third "-3".
 * A heading that already carries an id (a product's own serializer may add one)
 * is left alone, and its id still counts for deduplication.
 *
 * Runs after sanitizeRichText, which keeps an id on a heading only when it is a
 * plain token. Framework-free and DOM-free, like the rest of this package.
 *
 * A translation is a separate HTML value, so slugging it would give the German
 * page German anchors and a link to the English one would land at the top.
 * `transferHeadingIds` gives a translated body the ids of its source, heading
 * by heading, so one anchor works in every language. Delivery calls it when it
 * swaps a translated richtext value in.
 */

import { decodeEntities } from './sanitize.js'

const HEADING_RE = /<(h[2-6])\b([^>]*)>([\s\S]*?)<\/\1\s*>/gi
const ID_RE = /(?:^|\s)id\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/i
const ORDINAL_RE = /^\d+(?:\.\d+)*[.)]?\s+/

/** The id a heading's text slugs to, or "" when nothing is left of it. */
export function headingSlug(text: string): string {
  // Entities the sanitiser passes through are decoded where known (&amp;,
  // numeric), and a named one it does not know is dropped rather than slugged.
  return decodeEntities(text.replace(/<[^>]*>/g, ''))
    .replace(/&[a-z][a-z0-9]*;/gi, '')
    .trim()
    .replace(ORDINAL_RE, '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * The HTML with an id on every h2 to h6 that has none, derived from its text.
 * Everything else is passed through byte for byte.
 */
export function slugHeadings(html: string): string {
  if (typeof html !== 'string' || !html) return ''
  const used = new Set<string>()
  const claim = (base: string): string => {
    let candidate = base
    for (let n = 2; used.has(candidate); n++) candidate = `${base}-${n}`
    used.add(candidate)
    return candidate
  }
  return html.replace(HEADING_RE, (full, tag: string, attrs: string, inner: string) => {
    const own = ID_RE.exec(attrs)
    if (own) {
      const id = own[1] ?? own[2] ?? own[3] ?? ''
      if (id) used.add(id)
      return full
    }
    const base = headingSlug(inner)
    if (!base) return full
    return `<${tag}${attrs} id="${claim(base)}">${inner}</${tag}>`
  })
}

/** The ids slugHeadings gives the headings of `html`, in document order. */
export function headingIds(html: string): string[] {
  return [...slugHeadings(html).matchAll(HEADING_RE)].map((m) => ID_RE.exec(m[2] ?? '')).map((m) => m?.[1] ?? m?.[2] ?? m?.[3] ?? '')
}

/**
 * The translated HTML with the ids of the source's headings, position by
 * position, so an anchor derived from the source text resolves on every
 * language's page. A translated heading that already carries an id keeps it.
 * When the two bodies do not hold the same number of headings, the translation
 * is returned unchanged: there is no safe way to pair them, and slugHeadings on
 * the page gives it ids of its own.
 */
export function transferHeadingIds(source: string, translated: string): string {
  if (typeof translated !== 'string' || !translated || typeof source !== 'string' || !source) return translated
  const ids = headingIds(source)
  const targets = [...translated.matchAll(HEADING_RE)]
  if (!ids.length || ids.length !== targets.length) return translated
  let i = 0
  return translated.replace(HEADING_RE, (full, tag: string, attrs: string, inner: string) => {
    const id = ids[i++]
    if (!id || ID_RE.test(attrs)) return full
    return `<${tag}${attrs} id="${id}">${inner}</${tag}>`
  })
}
