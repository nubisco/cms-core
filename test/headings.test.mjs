// Run against the BUILT package, the way a consumer loads it: pnpm test.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { slugHeadings, headingSlug, headingIds, transferHeadingIds, sanitizeRichText } from '../dist/index.js'

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

test('the sanitiser keeps a heading id that is a plain token, and only that', () => {
  assert.equal(sanitizeRichText('<h2 id="installed-apps">7. Installed apps</h2>'), '<h2 id="installed-apps">7. Installed apps</h2>')
  assert.equal(sanitizeRichText('<h3 id="a b">x</h3><h2 id="1st">y</h2><h2 id="x&quot;onload=1">z</h2>'), '<h3>x</h3><h2>y</h2><h2>z</h2>')
  assert.equal(sanitizeRichText('<p id="lead">x</p>'), '<p>x</p>')
})

test('an id the sanitiser kept is left alone by slugHeadings', () => {
  const out = slugHeadings(sanitizeRichText('<h2 id="installed-apps">7. Installed apps: downloads</h2><h2>Alter</h2>'))
  assert.equal(out, '<h2 id="installed-apps">7. Installed apps: downloads</h2><h2 id="alter">Alter</h2>')
})

test('a translation takes the ids of its source, heading by heading', () => {
  const source = '<h2>7. Installed apps: downloads</h2><p>a</p><h3>The install heartbeat</h3><h2>8. Alter</h2>'
  const de = '<h2>7. Installierte Apps: Downloads</h2><p>b</p><h3>Der Installations-Heartbeat</h3><h2>8. Alter</h2>'
  assert.deepEqual(headingIds(source), ['installed-apps-downloads', 'the-install-heartbeat', 'alter'])
  assert.equal(
    transferHeadingIds(source, de),
    '<h2 id="installed-apps-downloads">7. Installierte Apps: Downloads</h2><p>b</p><h3 id="the-install-heartbeat">Der Installations-Heartbeat</h3><h2 id="alter">8. Alter</h2>',
  )
  // The page then slugs nothing new: the carried ids win.
  assert.equal(slugHeadings(sanitizeRichText(transferHeadingIds(source, de))), transferHeadingIds(source, de))
})

test('a translation with a different number of headings is returned unchanged', () => {
  const source = '<h2>One</h2><h2>Two</h2>'
  assert.equal(transferHeadingIds(source, '<h2>Eins</h2>'), '<h2>Eins</h2>')
  assert.equal(transferHeadingIds('<p>no headings</p>', '<h2>Eins</h2>'), '<h2>Eins</h2>')
  assert.equal(transferHeadingIds(source, ''), '')
})
