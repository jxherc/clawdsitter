import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PassThrough } from 'node:stream'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { createApp } from '../src/index.js'
import { DEFAULTS } from '../src/config.js'
import { stripAnsi } from '../src/detector.js'

const here = dirname(fileURLToPath(import.meta.url))
const FAKE = join(here, 'fake-claude.js')

// tiny-timing config so the backoff/limit waits are milliseconds, not minutes
function fastConfig(over = {}) {
  return {
    ...DEFAULTS,
    backoffSteps: ['30ms'],
    healObserveSeconds: 0.05,
    injectDelayMs: 0,
    resetGraceSeconds: 0,
    fallbackWaitMinutes: 0.001, // ~60ms
    ...over,
  }
}

function run(mode, configOver = {}) {
  const out = new PassThrough()
  let text = ''
  out.on('data', (d) => { text += d.toString() })
  out.columns = 80
  out.rows = 24
  const stdin = new PassThrough()
  const config = fastConfig(configOver)
  const app = createApp({
    config,
    command: process.execPath,
    args: [FAKE, mode],
    stdout: out,
    stdin,
  })
  return { app, get text() { return stripAnsi(text) } }
}

function waitFor(getText, re, ms = 5000) {
  return new Promise((resolve, reject) => {
    const t0 = Date.now()
    const iv = setInterval(() => {
      if (re.test(getText())) { clearInterval(iv); resolve(true) }
      else if (Date.now() - t0 > ms) { clearInterval(iv); reject(new Error(`timeout waiting for ${re}\ngot: ${getText()}`)) }
    }, 20)
  })
}

test('e2e transient: clawdsitter injects the phrase and the child resumes', async (t) => {
  const r = run('transient')
  try {
    await waitFor(() => r.text, /RESUMED:continue/)
    assert.match(r.text, /RESUMED:continue/)
  } finally {
    try { r.app.host.kill() } catch {}
  }
})

test('e2e limit (fallback wait): clawdsitter resumes after the wait', async (t) => {
  const r = run('limit')
  try {
    await waitFor(() => r.text, /RESUMED:continue/)
    assert.match(r.text, /RESUMED:continue/)
    assert.equal(r.app.supervisor.limitResumes, 1)
  } finally {
    try { r.app.host.kill() } catch {}
  }
})

test('e2e idle: healthy output triggers no injection', async (t) => {
  const r = run('idle')
  try {
    await waitFor(() => r.text, /READY: idle/)
    // give it a moment to (not) react
    await new Promise((res) => setTimeout(res, 200))
    assert.doesNotMatch(r.text, /RESUMED/)
    assert.equal(r.app.supervisor.busy, false)
  } finally {
    try { r.app.host.kill() } catch {}
  }
})

test('e2e respects a custom resumePhrase', async (t) => {
  const r = run('transient', { resumePhrase: 'keepgoing' })
  try {
    await waitFor(() => r.text, /RESUMED:keepgoing/)
    assert.match(r.text, /RESUMED:keepgoing/)
  } finally {
    try { r.app.host.kill() } catch {}
  }
})
