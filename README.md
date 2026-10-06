# @nubisco/cms-core

The framework-agnostic half of the Nubisco CMS client.

Everything here is plain TypeScript: the content contract, field resolution, and
the link, image and richtext models. No UI framework, ever. That constraint is
enforced by `scripts/check-no-framework.mjs`, which runs as the first step of the
build and fails on a single stray `import { ref } from 'vue'`.

## Why this package exists

The framework bindings depend on this one, so a rule about links or a fix to the
richtext model is written once and every binding inherits it:

```
@nubisco/cms-core     contract, resolve, evaluate, link, image, richtext
  |
  +-- @nubisco/cms-vue      components and composables for Vue
  +-- @nubisco/cms-react    later, and deliberately not before Vue is excellent
```

This mirrors `@prismicio/client` and `@prismicio/vue`.

## Status

Scaffold. The modules that belong here already exist, framework-free, inside
`cms-vue`: `link.ts`, `image.ts`, `richtext.ts`, `contract.ts`, `resolve.ts` and
`evaluate.ts`. Moving them here is a file move plus an import rewrite, which is
precisely why that boundary was kept clean rather than discovered later.

## Rendering authored HTML safely

A richtext field is HTML that anyone with write access to a document wrote, and
a renderer inserts it as HTML. Two functions stand between that and a script on
every page:

- `sanitizeRichText(html)` rebuilds the HTML from an allowlist of the tags and
  attributes an editor can write, escapes everything else, and drops scripts,
  styles, frames, comments and event handlers. Run it on every richtext value
  before inserting it (after `compileLinks`, before `applySerializers`). It is
  DOM-free, so the CMS runs the same function when a document is saved.
- `normalizeLink()` renders any destination in a scheme that could run code
  (`javascript:`, `data:`, `vbscript:`) inert, with status `'unsafe'`, even when
  the document marks it resolved. `isSafeUrl()` is the check on its own.

## The one rule

A module in this package may not import `vue`, `react`, `svelte`, `preact` or
`solid-js`. Framework code belongs in a binding package. If something here needs
reactivity, it takes a callback or returns a plain value and lets the binding
decide how to observe it.
