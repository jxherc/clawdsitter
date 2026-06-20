import { test } from 'node:test'
import assert from 'node:assert/strict'

import { parseArgs, makeOnData } from '../src/index.js'

// ---- parseArgs ----
test('empty argv -> null command, no args', () => {
  const p = parseArgs([])
  assert.equal(p.command, null)
  assert.deepEqual(p.args, [])
})

test('first token is the command, rest pass through', () => {
  const p = parseArgs(['claude', '--resume', 'sess-1'])
  assert.equal(p.command, 'claude')
  assert.deepEqual(p.args, ['--resume', 'sess-1'])
})

test('--help / -h set help', () => {
  assert.equal(parseArgs(['--help']).help, true)
  assert.equal(parseArgs(['-h']).help, true)
})

test('--version / -v set version', () => {
  assert.equal(parseArgs(['--version']).version, true)
  assert.equal(parseArgs(['-v']).version, true)
})

// ---- makeOnData wiring ----
function fakeSup(busy = false) {
  return {
    busy,
    calls: [],
    handleTransient() { this.calls.push(['t']) },
    handleLimit(x) { this.calls.push(['l', x]) },
    signalError() { this.calls.push(['s']) },
  }
}
function fakeWatcher(seq) {
  let i = 0
  return { feed: () => seq[i++] }
}

test('transient detection starts handleTransient', () => {
  const sup = fakeSup()
  const onData = makeOnData({ watcher: fakeWatcher([{ kind: 'transient', text: 'API Error' }]), supervisor: sup })
  assert.equal(onData('chunk'), 'transient')
  assert.deepEqual(sup.calls, [['t']])
})

test('limit detection starts handleLimit with the matched text', () => {
  const sup = fakeSup()
  const onData = makeOnData({ watcher: fakeWatcher([{ kind: 'limit', text: 'resets 2:10am' }]), supervisor: sup })
  assert.equal(onData('chunk'), 'limit')
  assert.deepEqual(sup.calls, [['l', 'resets 2:10am']])
})

test('no detection does nothing', () => {
  const sup = fakeSup()
  const onData = makeOnData({ watcher: fakeWatcher([null]), supervisor: sup })
  assert.equal(onData('healthy'), null)
  assert.deepEqual(sup.calls, [])
})

test('detection while busy signals a recurrence instead of starting again', () => {
  const sup = fakeSup(true)
  const onData = makeOnData({ watcher: fakeWatcher([{ kind: 'transient', text: 'API Error' }]), supervisor: sup })
  assert.equal(onData('chunk'), 'signal')
  assert.deepEqual(sup.calls, [['s']])
})

test('falls back to chunk text when detection has no text', () => {
  const sup = fakeSup()
  const onData = makeOnData({ watcher: fakeWatcher([{ kind: 'limit' }]), supervisor: sup })
  onData('raw chunk with resets 3:00am')
  assert.deepEqual(sup.calls, [['l', 'raw chunk with resets 3:00am']])
})
