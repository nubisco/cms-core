// Run against the BUILT package, the way a consumer loads it: pnpm test.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { sanitizeRichText as clean, isSafeUrl, normalizeLink } from '../dist/index.js'

test('clean editor markup comes back unchanged', () => {
  const samples = [
    '<p>Plain <strong>bold</strong>, <em>italic</em> and <code>code</code>.</p>',
    '<h2>Heading</h2><ul><li>One</li><li>Two</li></ul><blockquote>Quote</blockquote>',
    '<p><a href="https://github.com/nubisco" target="_blank" rel="noopener noreferrer">GitHub</a></p>',
    '<p><a href="/contact">Contact</a> or <a href="mailto:support@nubisco.io">email</a></p>',
    '<figure><img src="/media/shot.png" alt="A shot"><figcaption>Caption</figcaption></figure>',
    '<pre><code>npm install -g openbridge</code></pre>',
    '<p>Fish &amp; chips &lt;3, caf&eacute; &#169;</p>',
  ]
  for (const s of samples) assert.equal(clean(s), s)
})

test('scripts, handlers and dangerous elements are removed', () => {
  const cases = {
    '<p>a<script>alert(1)</script>b</p>': '<p>ab</p>',
    '<script src="https://evil.example/x.js"></script>': '',
    '<img src=x onerror=alert(1)>': '<img src="x">',
    '<p onclick="alert(1)" class="lead">x</p>': '<p class="lead">x</p>',
    '<a href="javascript:alert(1)">x</a>': '<a>x</a>',
    '<a href="JaVaScRiPt:alert(1)">x</a>': '<a>x</a>',
    '<a href="java\tscript:alert(1)">x</a>': '<a>x</a>',
    '<a href="&#106;avascript:alert(1)">x</a>': '<a>x</a>',
    '<a href="javascript&colon;alert(1)">x</a>': '<a>x</a>',
    '<a href=" javascript:alert(1)">x</a>': '<a>x</a>',
    '<a href="data:text/html;base64,PHNjcmlwdD4=">x</a>': '<a>x</a>',
    '<a href="vbscript:msgbox(1)">x</a>': '<a>x</a>',
    '<img src="data:image/svg+xml,<svg onload=alert(1)>">': '<img>',
    '<iframe src="https://evil.example"></iframe><p>after</p>': '<p>after</p>',
    '<style>body{display:none}</style><p>x</p>': '<p>x</p>',
    '<svg><script>alert(1)</script></svg><p>x</p>': '<p>x</p>',
    '<!-- <script>alert(1)</script> --><p>x</p>': '<p>x</p>',
    '<object data="x"></object><embed src="x">': '',
    '<p style="background:url(javascript:alert(1))">x</p>': '<p>x</p>',
    '<form action="https://evil.example"><input name="pw"></form>': '',
    '<base href="https://evil.example/">': '',
    '<meta http-equiv="refresh" content="0;url=javascript:alert(1)">': '',
  }
  for (const [input, expected] of Object.entries(cases)) assert.equal(clean(input), expected, input)
})

test('malformed markup cannot smuggle a tag through', () => {
  for (const input of [
    '<scr<script>ipt>alert(1)</script>',
    '<<script>script>alert(1)<</script>/script>',
    '<img """><script>alert(1)</script>">',
    '<a href="x" title="a>b" onclick="alert(1)">y</a>',
    '<p>unclosed <script>alert(1)',
    '<IMG SRC=JaVaScRiPt:alert(1)>',
    '<div><p>nested</div>',
  ]) {
    const out = clean(input)
    assert.doesNotMatch(out, /<script|<\/script|onerror|onclick|javascript:/i, `${input} -> ${out}`)
  }
})

test('output is well formed: every tag it opens, it closes', () => {
  assert.equal(clean('<p><strong>unclosed'), '<p><strong>unclosed</strong></p>')
  assert.equal(clean('<ul><li>one<li>two</ul>'), '<ul><li>one<li>two</li></li></ul>')
  assert.equal(clean('</p>stray close'), 'stray close')
})

test('a new-tab link always carries noopener', () => {
  assert.equal(clean('<a href="https://x.io" target="_blank">x</a>'), '<a href="https://x.io" target="_blank" rel="noopener">x</a>')
  assert.equal(
    clean('<a href="https://x.io" target="_blank" rel="noreferrer">x</a>'),
    '<a href="https://x.io" target="_blank" rel="noreferrer noopener">x</a>',
  )
  assert.equal(clean('<a href="/x" target="top">x</a>'), '<a href="/x">x</a>')
})

test('isSafeUrl', () => {
  for (const ok of ['', '/a', '/a:b', 'a/b', '?q=1', '#x', 'https://x.io', 'http://x.io', 'mailto:a@b.c', 'tel:+351', 'page'])
    assert.equal(isSafeUrl(ok), true, ok)
  for (const bad of ['javascript:x', 'JAVASCRIPT:x', 'data:x', 'vbscript:x', 'file:///etc/passwd', '\u0001javascript:x', 'java\nscript:x'])
    assert.equal(isSafeUrl(bad), false, bad)
})

test('a link in an unsafe scheme renders inert, whoever marked it ok', () => {
  assert.deepEqual(
    [normalizeLink('javascript:alert(1)').ok, normalizeLink('javascript:alert(1)').status, normalizeLink('javascript:alert(1)').href],
    [false, 'unsafe', ''],
  )
  const forged = normalizeLink({ kind: 'doc', route: '/x', href: 'javascript:alert(1)', status: 'ok' })
  assert.equal(forged.ok, false)
  assert.equal(forged.status, 'unsafe')
  assert.equal(normalizeLink({ kind: 'url', url: 'data:text/html,x' }).ok, false)
  // Ordinary links are untouched.
  assert.equal(normalizeLink({ kind: 'url', url: 'https://nubisco.io' }).href, 'https://nubisco.io')
  assert.equal(normalizeLink('/contact').href, '/contact')
  assert.equal(normalizeLink('mailto:support@nubisco.io').ok, true)
  assert.equal(normalizeLink({ kind: 'doc', route: '/x', href: '/x', status: 'ok' }).href, '/x')
})

test('linear time: no input makes the reader rescan the document per tag', () => {
  for (const s of ['<a "'.repeat(50000), '<'.repeat(200000), '<p>'.repeat(50000), "<a '".repeat(50000), '<a b'.repeat(50000)]) {
    const t = performance.now()
    clean(s)
    assert.ok(performance.now() - t < 500, `${s.slice(0, 8)}... took ${Math.round(performance.now() - t)}ms`)
  }
})
