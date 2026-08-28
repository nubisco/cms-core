/**
 * Load the built package the way a consumer will.
 *
 * 0.1.0 shipped to npm having passed its build AND its typecheck, and crashed on
 * the first import:
 *
 *   ERR_UNSUPPORTED_DIR_IMPORT .../@nubisco/cms-core/dist/contract
 *
 * `moduleResolution: "bundler"` let tsc accept extensionless relative imports
 * and emit them verbatim. A bundler resolves those, so cms-vue's vite build hid
 * it completely. Node's ESM loader does not.
 *
 * moduleResolution is NodeNext now, so the compiler rejects that at source. This
 * is the belt to that braces: it proves the EMITTED artefact loads, which is the
 * only claim that actually matters to someone installing the package.
 */
import { pathToFileURL } from 'node:url'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const entry = pathToFileURL(join(root, 'dist', 'index.js')).href

function join(...p) {
  return p.join('/')
}

// A representative slice of the public API: one value export per module, so a
// module that fails to load is caught rather than merely a missing name.
const EXPECTED = ['normalizeLink', 'linkAttrs', 'normalizeImage', 'isHtml', 'applySerializers', 'text', 'evaluate', 'evaluateGraph']

let mod
try {
  mod = await import(entry)
} catch (err) {
  console.error('cms-core does not load as ESM, which means the published package would not either:')
  console.error(`  ${err.code ?? 'Error'}: ${err.message}`)
  console.error('\nRun `pnpm run build` first. If it still fails, a relative import in src/ is missing its .js extension.')
  process.exit(1)
}

const missing = EXPECTED.filter((name) => typeof mod[name] !== 'function')
if (missing.length) {
  console.error(`cms-core loaded but does not export: ${missing.join(', ')}`)
  process.exit(1)
}

// Exercise one, so this is not merely a shape check.
const link = mod.normalizeLink({ kind: 'url', href: 'https://nubisco.io', status: 'ok' }, '')
if (!link || link.href !== 'https://nubisco.io') {
  console.error('cms-core loaded but normalizeLink did not round-trip a url link:', JSON.stringify(link))
  process.exit(1)
}

console.log(`cms-core loads as ESM: ${EXPECTED.length} exports present, normalizeLink round-trips.`)
