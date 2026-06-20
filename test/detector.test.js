import { test } from 'node:test'
import assert from 'node:assert/strict'

import { stripAnsi, classify, createWatcher } from '../src/detector.js'

// real captured strings
const AUTH = 'Failed to authenticate. API Error: 401 something (request id: abc)'
const CERT = 'API Error: Unable to connect to API (UNKNOWN_CERTIFICATE_VERIFICATION_ERROR)'
const LIMIT = "You've hit your session limit · resets 2:10am (Asia/Shanghai)"

test('classifies the real 401 proxy error as transient', () => {
  assert.equal(classify(AUTH).kind, 'transient')
})

test('classifies the real cert/connect error as transient', () => {
  assert.equal(classify(CERT).kind, 'transient')
})

test('classifies the real session-limit string as limit', () => {
  assert.equal(classify(LIMIT).kind, 'limit')
})

test('classifies a usage-limit phrasing as limit', () => {
  assert.equal(classify('Claude: you have hit your usage limit, try later').kind, 'limit')
})

test('healthy output classifies as null', () => {
  assert.equal(classify('Running tests... 18 passed. Editing file.js').kind, null)
  assert.equal(classify('').kind, null)
})

test('limit takes precedence when both patterns match', () => {
  const both = 'API Error: overloaded — also you hit your session limit · resets 3:00am'
  assert.equal(classify(both).kind, 'limit')
})

test('stripAnsi removes escape sequences and classify still works', () => {
  const wrapped = `\x1b[31m\x1b[1m${CERT}\x1b[0m`
  assert.ok(stripAnsi(wrapped).includes('Unable to connect'))
  assert.ok(!stripAnsi(wrapped).includes('\x1b'))
  assert.equal(classify(wrapped).kind, 'transient')
})

test('custom patterns override the defaults', () => {
  const patterns = { transient: 'BOOM', limit: 'STOPLIMIT' }
  assert.equal(classify('the BOOM happened', patterns).kind, 'transient')
  assert.equal(classify('STOPLIMIT now', patterns).kind, 'limit')
  // default-matching text no longer matches custom patterns
  assert.equal(classify(CERT, patterns).kind, null)
})

test('watcher returns null on healthy chunks and a detection when an error arrives', () => {
  const w = createWatcher()
  assert.equal(w.feed('all good, working...'), null)
  const d = w.feed(CERT)
  assert.equal(d?.kind, 'transient')
})

test('watcher does not re-fire on stale error left in the buffer', () => {
  const w = createWatcher()
  assert.equal(w.feed(CERT)?.kind, 'transient') // first detection
  // a following healthy chunk must NOT re-detect the now-consumed error,
  // even though the old text would still fit in the carryover window
  assert.equal(w.feed('RESUMED:continue'), null)
  assert.equal(w.feed('working on it...'), null)
})

test('watcher stitches a match across a chunk boundary', () => {
  const w = createWatcher()
  // "Unable to conn" alone matches nothing in the patterns -> null
  assert.equal(w.feed('status: Unable to conn'), null)
  // completion arrives next chunk; carryover stitches "Unable to connect"
  const d = w.feed('ect to the server')
  assert.equal(d?.kind, 'transient')
})
