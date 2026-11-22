// Run against the BUILT package, the way a consumer loads it: pnpm test.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { slugHeadings, headingSlug, sanitizeRichText } from '../dist/index.js'

test('a heading gets an id from its text, a leading ordinal dropped', () => {
  assert.equal(headingSlug('7. Installed apps: downloads, updates and the install heartbeat'), 'installed-apps-downloads-updates-and-the-install-heartbeat')
  assert.equal(headingSlug('8. Alter'), 'alter')
  assert.equal(headingSlug('2.1) Café <em>crème</em> &amp; co &#169; &hellip;'), 'cafe-creme-co')
  assert.equal(headingSlug('  ---  '), '')
  assert.equal(headingSlug('2026'), '2026')
})

test('every h2 to h6 without an id gets one, everything else is untouched', () => {
  const html = '<p>Intro</p><h2>7. Installed apps</h2><p>x</p><h3 class="sub">The install heartbeat</h3><h4>Stagewright</h4><h1>Title</h1>'
  assert.equal(
    slugHeadings(html),
    '<p>Intro</p><h2 id="installed-apps">7. Installed apps</h2><p>x</p><h3 class="sub" id="the-install-heartbeat">The install heartbeat</h3><h4 id="stagewright">Stagewright</h4><h1>Title</h1>',
  )
})

test('repeated headings get -2, -3, and an authored id is kept and counted', () => {
  const html = '<h2>Notes</h2><h2>Notes</h2><h2 id="notes-2">Own</h2><h2>Notes</h2><h3>Notes-2</h3>'
  assert.equal(
    slugHeadings(html),
    '<h2 id="notes">Notes</h2><h2 id="notes-2">Notes</h2><h2 id="notes-2">Own</h2><h2 id="notes-3">Notes</h2><h3 id="notes-2-2">Notes-2</h3>',
  )
})

test('a heading with no text left is left without an id, and empty input is empty', () => {
  assert.equal(slugHeadings('<h2>&nbsp;</h2>'), '<h2>&nbsp;</h2>')
  assert.equal(slugHeadings(''), '')
})

test('runs after the sanitiser: the id survives, an authored one does not', () => {
  const out = slugHeadings(sanitizeRichText('<h2 id="installed-apps">7. Installed apps: downloads</h2>'))
  assert.equal(out, '<h2 id="installed-apps-downloads">7. Installed apps: downloads</h2>')
})
