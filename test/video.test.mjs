// Run against the BUILT package, the way a consumer loads it: pnpm test.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeVideo, hasVideo } from '../dist/index.js'

test('the contract shape comes back resolved', () => {
  assert.deepEqual(
    normalizeVideo({
      src: ' /media/loop.mp4 ',
      poster: '/media/loop.jpg',
      mobileSrc: '/media/loop-m.mp4',
      label: 'A rig being wired',
      w: 1600,
      h: '900',
    }),
    {
      src: '/media/loop.mp4',
      poster: '/media/loop.jpg',
      mobileSrc: '/media/loop-m.mp4',
      label: 'A rig being wired',
      width: 1600,
      height: 900,
    },
  )
})

test("delivery's media spelling and image-shaped posters are read too", () => {
  const v = normalizeVideo({
    url: '/media/loop.mp4',
    poster: { src: '/media/loop.jpg', alt: '' },
    mobile: { url: '/media/loop-m.mp4' },
    width: 640,
    height: 360,
  })
  assert.equal(v.src, '/media/loop.mp4')
  assert.equal(v.poster, '/media/loop.jpg')
  assert.equal(v.mobileSrc, '/media/loop-m.mp4')
  assert.equal(v.width, 640)
  assert.equal(v.height, 360)
})

test('a { $t } label resolves through the message table', () => {
  const v = normalizeVideo({ src: '/a.mp4', poster: '/a.jpg', label: { $t: 'hero.film' } }, { 'hero.film': 'The film' })
  assert.equal(v.label, 'The film')
})

test('nothing authored is nothing to draw', () => {
  for (const empty of [undefined, null, '', '  ', {}, [], 3, { poster: '/a.jpg' }]) {
    assert.deepEqual(normalizeVideo(empty), { src: '', poster: '', label: '' })
  }
  assert.deepEqual(normalizeVideo('/a.mp4'), {
    src: '/a.mp4',
    poster: '',
    label: '',
  })
})

test('a video is drawn only with its poster', () => {
  assert.equal(hasVideo({ src: '/a.mp4', poster: '/a.jpg' }), true)
  assert.equal(hasVideo({ src: '/a.mp4' }), false)
  assert.equal(hasVideo('/a.mp4'), false)
  assert.equal(hasVideo(undefined), false)
})
