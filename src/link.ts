/**
 * The `link` field, generalised out of the site that first shipped it.
 *
 * A link used to be a raw href typed as a free string, so a typo was a silent
 * 404, renaming a route broke every href pointing at it, and nothing stopped an
 * editor linking to a page that is deliberately held back. The CMS models a
 * link as an object and DELIVERY RESOLVES IT server side, so a renderer needs no
 * resolver of its own:
 *
 *   { "kind": "doc",   "route": "/docs", "href": "/docs", "status": "ok" }
 *   { "kind": "url",   "url": "https://…", "newTab": true }
 *   { "kind": "media", "id": "<media id>", "href": "https://…/asset.pdf", "newTab": true }
 *
 * `newTab` is authored on ANY of the three kinds. It is orthogonal to `status`:
 * a link that is not 'ok' renders inert whatever the editor asked for, because
 * there is no destination to open in either tab.
 *
 * `status` is delivery's verdict on a `doc` reference against the SAME site and
 * environment: 'ok', 'missing' (no document for that route) or 'unpublished'
 * (the document exists but is not visible to this caller).
 *
 * Two rules this module exists to enforce, in ONE place rather than in each of
 * the fields a product renders as a link:
 *
 *  1. BACKWARD COMPATIBILITY. Documents in the wild still hold plain strings,
 *     and a document is migrated when it is migrated. A bare string is
 *     therefore a first-class input: a leading '/' reads as an internal route,
 *     anything else as an external URL. Nothing may 404 or render blank because
 *     a document has not been migrated yet.
 *
 *  2. A LINK THAT IS NOT 'ok' RENDERS INERT. The label still shows, as plain
 *     text, never as a dead anchor. This is what stops a held-back page (an
 *     unreleased product, say) leaking through a link on a page that IS live:
 *     the URL never reaches the markup at all, so it cannot be read out of the
 *     rendered HTML either.
 */

/** Delivery's verdict, plus the two verdicts a renderer reaches on its own. */
export type LinkStatus =
  | 'ok'
  /** No document for that route. */
  | 'missing'
  /** The document exists but is not published (or not visible to this caller). */
  | 'unpublished'
  /** Nothing authored at all. */
  | 'empty'
  /** A reference delivery did not resolve (a media id with no asset URL). */
  | 'unresolved'

export type LinkKind = 'doc' | 'url' | 'media' | 'none'

/**
 * An authored link, normalised. Named `ResolvedLink` rather than `CmsLink`
 * because `CmsLink` is the component that renders one.
 */
export interface ResolvedLink {
  /** True when this may render as a real anchor. False means render it inert. */
  ok: boolean
  /** Where it points. Always '' when `ok` is false, so it cannot leak. */
  href: string
  /** True when `href` is a route the host app owns, so its router should take it. */
  internal: boolean
  /**
   * Whether it should open in a new tab. Authored per link, for ALL THREE
   * kinds: an editor can send an internal page to a new tab just as easily as
   * an external URL, and a linked PDF in the media library is the case that
   * made this matter. Never true for a destination that must open in place
   * (#anchor, mailto:, tel:), where a new tab would leave an empty one behind.
   */
  newTab: boolean
  status: LinkStatus
  kind: LinkKind
}

/** Any object-shaped authored value. */
type Bag = Record<string, unknown>

const INERT: ResolvedLink = {
  ok: false,
  href: '',
  internal: false,
  newTab: false,
  status: 'empty',
  kind: 'none',
}

function inert(status: LinkStatus, kind: LinkKind): ResolvedLink {
  return { ...INERT, status, kind }
}

/** A route the host app can navigate to in place: site-absolute, not protocol-relative. */
export function isInternalHref(href: string): boolean {
  return href.startsWith('/') && !href.startsWith('//')
}

/**
 * A scheme that must never open a new tab: an in-page anchor, a mail client, a
 * dialler. `target="_blank"` on those leaves an empty tab behind.
 */
function opensInPlace(href: string): boolean {
  return href.startsWith('#') || /^(mailto:|tel:|sms:)/i.test(href)
}

/** The legacy shape: a bare href typed as a free string. */
function fromString(raw: string): ResolvedLink {
  const href = raw.trim()
  if (!href) return INERT
  if (isInternalHref(href)) {
    return { ok: true, href, internal: true, newTab: false, status: 'ok', kind: 'doc' }
  }
  return { ok: true, href, internal: false, newTab: !opensInPlace(href), status: 'ok', kind: 'url' }
}

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

function readStatus(v: unknown): LinkStatus | '' {
  const s = str(v)
  if (s === 'ok' || s === 'missing' || s === 'unpublished' || s === 'empty' || s === 'unresolved') return s
  return ''
}

/**
 * Whether this link opens in a new tab.
 *
 * `newTab` is authored for every kind, so the editor's answer wins whenever
 * they gave one. `fallback` is what the kind does when they did not, which is
 * how documents written before the switch existed keep behaving as they did.
 *
 * The one thing an editor cannot ask for is a new tab on a destination that
 * must open in place: `#pricing`, `mailto:` and `tel:` open a blank tab and
 * strand the visitor there, so they are refused regardless of what is stored.
 */
function wantsNewTab(o: Bag, href: string, fallback: boolean): boolean {
  if (opensInPlace(href)) return false
  return typeof o.newTab === 'boolean' ? o.newTab : fallback
}

/** The object shape, as delivery serves it (and as the console posts it). */
function fromObject(o: Bag): ResolvedLink {
  const kindRaw = str(o.kind)
  const status = readStatus(o.status)
  // Delivery adds `href` AND `status` to every doc reference it serves.
  const resolved = str(o.href)
  const route = str(o.route)
  const url = str(o.url)
  const kind: LinkKind =
    kindRaw === 'doc' || kindRaw === 'url' || kindRaw === 'media'
      ? kindRaw
      : route
        ? 'doc'
        : url
          ? 'url'
          : resolved
            ? isInternalHref(resolved)
              ? 'doc'
              : 'url'
            : 'none'

  // Delivery said no. The label renders, the destination does not.
  if (status && status !== 'ok') return inert(status, kind)

  if (kind === 'doc') {
    // A doc reference is only ever safe on delivery's say-so. An object that
    // arrives WITHOUT a status is one nothing has resolved: the console's
    // live-preview patch posts the reference the editor just picked, and
    // delivery serves a document unresolved if resolution itself failed. Both
    // could be pointing at a route that is missing or deliberately held back,
    // so the unvouched-for reference renders inert rather than as a live anchor
    // whose target has never been checked. Once the edit is saved, delivery
    // resolves it and it lights up. A LEGACY BARE STRING is a different case
    // and stays live (see fromString): it is the shape every unmigrated
    // document still holds, and delivery coerces and resolves it server side.
    if (!status) return inert('unresolved', 'doc')
    const href = resolved || route
    if (!href) return inert('empty', 'doc')
    return {
      ok: true,
      href,
      internal: isInternalHref(href),
      // An internal destination the editor asked to open away. It stays an
      // INTERNAL link (the href is still a route the host owns) and the router
      // is told to keep its hands off it in `navigateLink`.
      newTab: wantsNewTab(o, href, false),
      status: 'ok',
      kind: 'doc',
    }
  }

  if (kind === 'media') {
    // A media link that carries only an id is one delivery has not resolved.
    // Rendering `href="<id>"` would be a dead anchor, so it goes inert.
    const href = resolved || url || str(o.src)
    if (!href) return inert('unresolved', 'media')
    return {
      ok: true,
      href,
      internal: isInternalHref(href),
      // A media asset defaults to a new tab: a PDF or a zip is a side trip, not
      // a page of the site. An editor can switch it off.
      newTab: wantsNewTab(o, href, true),
      status: 'ok',
      kind: 'media',
    }
  }

  const href = resolved || url
  if (!href) return inert('empty', kind)
  return {
    ok: true,
    href,
    internal: isInternalHref(href),
    // Unauthored, an external URL opens away; a site-absolute one stays in place.
    newTab: wantsNewTab(o, href, !isInternalHref(href)),
    status: 'ok',
    kind: 'url',
  }
}

/**
 * Normalise ANY authored link value: the object shape, a legacy bare string, or
 * nothing at all. `fallback` is the host's own bundled href, used only when the
 * document carries nothing (blocks often keep a coded default so a
 * half-authored document still renders a complete page).
 */
export function normalizeLink(value: unknown, fallback = ''): ResolvedLink {
  if (typeof value === 'string') {
    const v = fromString(value)
    return v.ok || v.status !== 'empty' ? v : fromString(fallback)
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) return fromObject(value as Bag)
  return fromString(fallback)
}

/** The first alias that is filled, for documents that spell a field several ways. */
export function pickField(source: Record<string, unknown> | undefined, aliases: readonly string[]): unknown {
  if (!source) return undefined
  for (const key of aliases) {
    const v = source[key]
    if (v === undefined || v === null) continue
    if (typeof v === 'string' && !v.trim()) continue
    return v
  }
  return undefined
}

/** The link under the first accepted spelling that is filled. */
export function pickLink(
  source: Record<string, unknown> | undefined,
  aliases: readonly string[],
  fallback = '',
): ResolvedLink {
  return normalizeLink(pickField(source, aliases), fallback)
}

/**
 * The attributes an anchor needs, or NOTHING when the link is inert.
 *
 * Binding this with `v-bind` on a `<component :is="linkTag(link)">` is the whole
 * of rule 2: an inert link gets no `href`, no `target` and no `rel`, so it
 * renders as the label in plain text.
 */
export function linkAttrs(link: ResolvedLink): Record<string, string> {
  if (!link.ok || !link.href) return {}
  const out: Record<string, string> = { href: link.href }
  if (link.newTab) {
    out.target = '_blank'
    out.rel = 'noopener'
  }
  return out
}

/** The tag an anchor slot should render: a real link, or plain text. */
export function linkTag(link: ResolvedLink): 'a' | 'span' {
  return link.ok && link.href ? 'a' : 'span'
}

/** The class that paints an inert link as body copy rather than as a link. */
export function linkClass(link: ResolvedLink): string {
  return link.ok && link.href ? '' : 'cms-link--inert'
}
