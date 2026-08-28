/**
 * cms-core must never import a UI framework.
 *
 * This package exists so `@nubisco/cms-vue`, and one day `cms-react` and
 * `cms-svelte`, can share one implementation of the content contract, field
 * resolution and the link, image and richtext models. The moment a module here
 * imports `vue`, that stops being true and every future binding inherits a
 * dependency it cannot use.
 *
 * A single stray import would fail no other check, so it fails this one.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const FRAMEWORKS = ['vue', 'react', 'svelte', 'preact', '@vue/', 'solid-js']

function walk(dir) {
  const out = []
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry)
    if (statSync(p).isDirectory()) out.push(...walk(p))
    else if (/\.(ts|mts|js|mjs)$/.test(entry)) out.push(p)
  }
  return out
}

let bad = 0
let files = 0
for (const file of walk('src')) {
  files++
  const src = readFileSync(file, 'utf8')
  for (const m of src.matchAll(/^\s*(?:import|export)[^'"]*from\s*['"]([^'"]+)['"]/gm)) {
    const spec = m[1]
    if (FRAMEWORKS.some((f) => spec === f || spec.startsWith(f))) {
      console.error(`  ${file} imports "${spec}"`)
      bad++
    }
  }
}

if (bad) {
  console.error(`\ncms-core imported a framework ${bad} time(s). That is the one thing this package may not do.`)
  process.exit(1)
}
console.log(`cms-core is framework-free: ${files} module(s) checked.`)
