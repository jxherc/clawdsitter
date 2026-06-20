import { test } from 'node:test'
import assert from 'node:assert/strict'

import { createNotifier } from '../src/notify.js'

function fakeLib() {
  const calls = []
  return { calls, notify: (opts) => calls.push(opts) }
}

test('enabled by default and forwards title/message to the lib', () => {
  const lib = fakeLib()
  const n = createNotifier({ notify: { toast: true } }, lib)
  const fired = n.toast('clawdsitter', 'resumed after limit')
  assert.equal(fired, true)
  assert.equal(lib.calls.length, 1)
  assert.equal(lib.calls[0].title, 'clawdsitter')
  assert.equal(lib.calls[0].message, 'resumed after limit')
})

test('treats missing notify config as enabled', () => {
  const lib = fakeLib()
  const n = createNotifier({}, lib)
  assert.equal(n.enabled, true)
  n.toast('a', 'b')
  assert.equal(lib.calls.length, 1)
})

test('disabled when notify.toast === false: does not call the lib', () => {
  const lib = fakeLib()
  const n = createNotifier({ notify: { toast: false } }, lib)
  const fired = n.toast('a', 'b')
  assert.equal(fired, false)
  assert.equal(lib.calls.length, 0)
})

test('swallows a throwing lib without bubbling up', () => {
  const lib = { notify: () => { throw new Error('no notifier installed') } }
  const n = createNotifier({ notify: { toast: true } }, lib)
  assert.doesNotThrow(() => n.toast('a', 'b'))
})
