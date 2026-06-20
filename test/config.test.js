import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { DEFAULTS, parseDuration, loadConfig, configHome } from '../src/config.js'

function tmpHome() {
  return mkdtempSync(join(tmpdir(), 'claw-cfg-'))
}

test('DEFAULTS has the expected shape', () => {
  assert.equal(DEFAULTS.claudeCommand, 'claude')
  assert.equal(DEFAULTS.resumePhrase, 'continue')
  assert.deepEqual(DEFAULTS.backoffSteps, ['10s', '30s', '1m', '5m', '10m'])
  assert.equal(DEFAULTS.resetGraceSeconds, 60)
  assert.equal(DEFAULTS.maxResumes, 0)
  assert.equal(typeof DEFAULTS.patterns.transient, 'string')
  assert.equal(typeof DEFAULTS.patterns.limit, 'string')
  assert.equal(DEFAULTS.notify.toast, true)
})

test('parseDuration handles s / m / h / ms', () => {
  assert.equal(parseDuration('10s'), 10000)
  assert.equal(parseDuration('30s'), 30000)
  assert.equal(parseDuration('1m'), 60000)
  assert.equal(parseDuration('5m'), 300000)
  assert.equal(parseDuration('10m'), 600000)
  assert.equal(parseDuration('1h'), 3600000)
  assert.equal(parseDuration('500ms'), 500)
})

test('parseDuration treats bare numbers as ms', () => {
  assert.equal(parseDuration(250), 250)
  assert.equal(parseDuration('250'), 250)
})

test('parseDuration rejects junk', () => {
  assert.throws(() => parseDuration('soon'))
  assert.throws(() => parseDuration(''))
  assert.throws(() => parseDuration(null))
})

test('loadConfig returns DEFAULTS when no file present', () => {
  const home = tmpHome()
  try {
    const cfg = loadConfig({ home })
    assert.deepEqual(cfg.backoffSteps, DEFAULTS.backoffSteps)
    assert.equal(cfg.resumePhrase, 'continue')
    assert.equal(cfg.notify.toast, true)
  } finally {
    rmSync(home, { recursive: true, force: true })
  }
})

test('loadConfig merges a partial user file over defaults', () => {
  const home = tmpHome()
  try {
    writeFileSync(join(home, 'config.json'), JSON.stringify({ resumePhrase: 'keep going', maxResumes: 3 }))
    const cfg = loadConfig({ home })
    assert.equal(cfg.resumePhrase, 'keep going')
    assert.equal(cfg.maxResumes, 3)
    // untouched keys still come from defaults
    assert.deepEqual(cfg.backoffSteps, DEFAULTS.backoffSteps)
  } finally {
    rmSync(home, { recursive: true, force: true })
  }
})

test('loadConfig deep-merges nested objects', () => {
  const home = tmpHome()
  try {
    writeFileSync(join(home, 'config.json'), JSON.stringify({ notify: { toast: false }, patterns: { limit: 'CUSTOM' } }))
    const cfg = loadConfig({ home })
    assert.equal(cfg.notify.toast, false)
    assert.equal(cfg.patterns.limit, 'CUSTOM')
    // sibling nested key preserved from defaults
    assert.equal(cfg.patterns.transient, DEFAULTS.patterns.transient)
  } finally {
    rmSync(home, { recursive: true, force: true })
  }
})

test('loadConfig honors CLAWDSITTER_HOME env override', () => {
  const home = tmpHome()
  const prev = process.env.CLAWDSITTER_HOME
  try {
    writeFileSync(join(home, 'config.json'), JSON.stringify({ resumePhrase: 'via-env' }))
    process.env.CLAWDSITTER_HOME = home
    const cfg = loadConfig()
    assert.equal(cfg.resumePhrase, 'via-env')
    assert.equal(configHome(), home)
  } finally {
    if (prev === undefined) delete process.env.CLAWDSITTER_HOME
    else process.env.CLAWDSITTER_HOME = prev
    rmSync(home, { recursive: true, force: true })
  }
})

test('loadConfig ignores a corrupt config file and falls back to defaults', () => {
  const home = tmpHome()
  try {
    writeFileSync(join(home, 'config.json'), '{ not valid json ')
    const cfg = loadConfig({ home })
    assert.equal(cfg.resumePhrase, 'continue')
  } finally {
    rmSync(home, { recursive: true, force: true })
  }
})
