import { test } from 'node:test'
import assert from 'node:assert/strict'

import { createSupervisor } from '../src/supervisor.js'

const tick = () => new Promise((r) => setImmediate(r))

// manual clock: sleep() never resolves on its own; the test resolves them FIFO via flush().
function harness(overrides = {}) {
  const sleeps = []
  const injects = []
  const logs = []
  const notes = []
  const resolvers = []
  const sleep = (ms) => {
    sleeps.push(ms)
    return new Promise((r) => resolvers.push(r))
  }
  async function flush() {
    const r = resolvers.shift()
    if (!r) throw new Error('no pending sleep to flush')
    r()
    await tick()
  }
  const config = {
    backoffSteps: ['10s', '30s', '1m', '5m', '10m'],
    resetGraceSeconds: 60,
    healObserveSeconds: 7, // distinct from any backoff step so we can tell them apart
    injectDelayMs: 0,
    resumePhrase: 'continue',
    maxResumes: 0,
    fallbackWaitMinutes: 60,
    ...overrides,
  }
  const sup = createSupervisor({
    config,
    sleep,
    inject: (s) => injects.push(s),
    log: (e, m) => logs.push([e, m]),
    notify: (t, b) => notes.push([t, b]),
    now: () => new Date(2026, 5, 20, 1, 0, 0), // June 20 2026 01:00
  })
  return { sup, sleeps, injects, logs, notes, flush }
}

const STEPS = [10000, 30000, 60000, 300000, 600000]

test('transient heals on the first attempt -> one inject, resumed', async () => {
  const h = harness()
  const p = h.sup.handleTransient()
  await h.flush() // backoff 10s -> inject + observe queued
  await h.flush() // observe window, no error -> healed
  assert.equal(await p, 'resumed')
  assert.deepEqual(h.injects, ['continue\r'])
  assert.equal(h.sleeps[0], 10000)
})

test('transient that never heals -> 5 injects then gave-up', async () => {
  const h = harness()
  const p = h.sup.handleTransient()
  for (let i = 0; i < 5; i++) {
    await h.flush() // backoff step -> inject
    h.sup.signalError() // error recurs during observe
    await h.flush() // observe -> not healed
  }
  assert.equal(await p, 'gave-up')
  assert.equal(h.injects.length, 5)
  assert.deepEqual(h.sleeps.filter((s) => STEPS.includes(s)), STEPS)
})

test('transient heals on the second attempt -> two injects, resumed', async () => {
  const h = harness()
  const p = h.sup.handleTransient()
  await h.flush() // step1 -> inject1
  h.sup.signalError() // still broken
  await h.flush() // observe1 -> not healed
  await h.flush() // step2 -> inject2
  await h.flush() // observe2 -> healed
  assert.equal(await p, 'resumed')
  assert.equal(h.injects.length, 2)
})

test('limit waits until reset + grace, then injects once', async () => {
  const h = harness()
  const p = h.sup.handleLimit('you hit your session limit · resets 2:10am')
  await h.flush() // the single wait -> inject
  assert.equal(await p, 'resumed')
  assert.equal(h.injects.length, 1)
  // 01:00 -> 02:10 is 4200s, + 60s grace
  assert.equal(h.sleeps[0], (4200 + 60) * 1000)
})

test('limit with an unparseable reset falls back to fallbackWaitMinutes', async () => {
  const h = harness()
  const p = h.sup.handleLimit('you hit your usage limit, sorry')
  await h.flush()
  assert.equal(await p, 'resumed')
  assert.equal(h.sleeps[0], (60 * 60 + 60) * 1000) // 60m + 60s grace
})

test('maxResumes cap -> second limit gives up without sleeping', async () => {
  const h = harness({ maxResumes: 1 })
  const p1 = h.sup.handleLimit('resets 2:10am')
  await h.flush()
  assert.equal(await p1, 'resumed')
  assert.equal(h.sup.limitResumes, 1)

  const before = h.sleeps.length
  const r2 = await h.sup.handleLimit('resets 2:10am')
  assert.equal(r2, 'gave-up')
  assert.equal(h.sleeps.length, before) // no new sleep
  assert.equal(h.injects.length, 1)
})

test('busy guard: re-entrant call returns busy', async () => {
  const h = harness()
  const p1 = h.sup.handleTransient() // enters, awaits first backoff sleep
  await tick()
  const r = await h.sup.handleTransient()
  assert.equal(r, 'busy')
  // cleanup p1 (heal it)
  await h.flush()
  await h.flush()
  assert.equal(await p1, 'resumed')
})

test('injectDelayMs > 0 adds a settle sleep before the inject', async () => {
  const h = harness({ injectDelayMs: 500 })
  const p = h.sup.handleTransient()
  await h.flush() // backoff step -> now settle sleep queued, no inject yet
  assert.equal(h.injects.length, 0)
  await h.flush() // settle sleep -> inject fires
  assert.equal(h.injects.length, 1)
  assert.ok(h.sleeps.includes(500))
  await h.flush() // observe -> healed
  assert.equal(await p, 'resumed')
})

test('resume logs and notifies', async () => {
  const h = harness()
  const p = h.sup.handleLimit('resets 2:10am')
  await h.flush()
  await p
  assert.ok(h.logs.some(([e]) => e === 'resumed'))
  assert.ok(h.notes.length >= 1)
})

test('give-up logs and notifies', async () => {
  const h = harness()
  const p = h.sup.handleTransient()
  for (let i = 0; i < 5; i++) {
    await h.flush()
    h.sup.signalError()
    await h.flush()
  }
  await p
  assert.ok(h.logs.some(([e]) => e === 'gave-up'))
  assert.ok(h.notes.some(([, b]) => /gave up/i.test(b)))
})
