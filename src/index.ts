/**
 * @nubisco/cms-core
 *
 * The framework-agnostic half of the Nubisco CMS client. Everything here is
 * plain TypeScript: the content contract, field resolution, and the link, image
 * and richtext models. No UI framework, enforced by scripts/check-no-framework.mjs.
 *
 * Framework bindings live in sibling packages and depend on this one:
 *   @nubisco/cms-vue     components and composables for Vue
 *   @nubisco/cms-react   (later, and deliberately not before Vue is excellent)
 *
 * The modules that belong here already exist, framework-free, inside cms-vue:
 *   link.ts  image.ts  richtext.ts  contract.ts  resolve.ts  evaluate.ts
 * Extracting them is a file move plus an import rewrite, which is the point of
 * having kept that boundary clean.
 */

export const CMS_CORE_VERSION = '0.1.0'
