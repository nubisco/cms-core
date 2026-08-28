/**
 * @nubisco/cms-core
 *
 * The framework-agnostic half of the Nubisco CMS client. Everything here is
 * plain TypeScript: the content contract, field resolution, the logic graph, and
 * the link, image and richtext models. No UI framework, enforced at build time
 * by scripts/check-no-framework.mjs.
 *
 * Framework bindings live in sibling packages and DEPEND on this one, so a site
 * never installs the core directly:
 *   @nubisco/cms-vue     components and composables for Vue
 *   @nubisco/cms-react   (later, and deliberately not before Vue is excellent)
 *
 * These modules were extracted from cms-vue, where a boundary check had kept
 * them framework-free from the start. That is why this was a file move and an
 * import rewrite rather than a rewrite.
 */

// The content contract: the shape of everything delivery returns.
export * from './contract'

// Field resolution: reading a value out of a document without guessing at it.
export { isTRef, isImage, isLink, text } from './resolve'

// Links are typed references, never free-text hrefs. `status` is what lets a
// renderer decide to paint an anchor, inert copy, or nothing at all.
export type { LinkStatus, LinkKind, ResolvedLink } from './link'
export { isInternalHref, normalizeLink, pickField, pickLink, linkAttrs, linkTag, linkClass } from './link'

export type { ResolvedImage } from './image'
export { normalizeImage, hasImage } from './image'

// Rich text as a model, not a string: a renderer decides the tags.
export type {
  RichTextNodeType,
  RichTextNode,
  RichTextRewrite,
  RichTextSerializer,
  RichTextSerializers,
} from './richtext'
export { compileLinks, nodeTypeOf, applySerializers, isHtml } from './richtext'

// Conditional content: visibility rules authored in the console.
export type { InputResolver, LogicEnv } from './evaluate'
export { evaluate } from './evaluate'
export type { BlueprintCard, GraphResult } from './graph'
export { NODE_SPECS, toCards, evaluateGraph } from './graph'
