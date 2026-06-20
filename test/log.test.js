import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { createLog, defaultLogPath } from '../src/log.js'

function tmp() {
  return mkdtempSync(join(tmpdir(), 'claw-log-'))
}
const lines = (p) => readFileSync(p, 'utf8').split('\n').filter(Boolean)

test('append writes a line to the log file', () => {
  const dir = tmp()
  try {
    const p = join(dir, 'log')
    const log = createLog(p)
    log.append('detected', 'transient error')
    assert.ok(existsSync(p))
    assert.equal(lines(p).length, 1)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('line carries a timestamp, the event and the message', () => {
  const dir = tmp()
  try {
    const p = join(dir, 'log')
    createLog(p).append('resumed', 'after limit')
    const line = lines(p)[0]
    assert.match(line, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/)
    assert.match(line, /resumed/)
    assert.match(line, /after limit/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('multiple appends accumulate in order', () => {
  const dir = tmp()
  try {
    const p = join(dir, 'log')
    const log = createLog(p)
    log.append('a', '1')
    log.append('b', '2')
    log.append('c', '3')
    const ls = lines(p)
    assert.equal(ls.length, 3)
    assert.match(ls[0], /1/)
    assert.match(ls[2], /3/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('creates the parent directory if missing', () => {
  const dir = tmp()
  try {
    const p = join(dir, 'nested', 'deeper', 'log')
    createLog(p).append('x', 'y')
    assert.ok(existsSync(p))
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('trims to the last 500 lines by default', () => {
  const dir = tmp()
  try {
    const p = join(dir, 'log')
    const log = createLog(p)
    for (let i = 0; i < 600; i++) log.append('n', String(i))
    const ls = lines(p)
    assert.equal(ls.length, 500)
    assert.match(ls[0], /\b100\b/)   // first 100 dropped
    assert.match(ls[ls.length - 1], /\b599\b/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('respects a custom maxLines', () => {
  const dir = tmp()
  try {
    const p = join(dir, 'log')
    const log = createLog(p, { maxLines: 10 })
    for (let i = 0; i < 25; i++) log.append('n', String(i))
    const ls = lines(p)
    assert.equal(ls.length, 10)
    assert.match(ls[ls.length - 1], /\b24\b/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('collapses newlines in the message to keep one line per entry', () => {
  const dir = tmp()
  try {
    const p = join(dir, 'log')
    createLog(p).append('multi', 'line one\nline two\r\nline three')
    const ls = lines(p)
    assert.equal(ls.length, 1)
    assert.match(ls[0], /line one line two line three/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('handles an empty message without throwing', () => {
  const dir = tmp()
  try {
    const p = join(dir, 'log')
    const log = createLog(p)
    assert.doesNotThrow(() => log.append('ping', ''))
    assert.equal(lines(p).length, 1)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('exposes the resolved path and defaultLogPath joins home', () => {
  const dir = tmp()
  try {
    const p = join(dir, 'log')
    const log = createLog(p)
    assert.equal(log.path, p)
    assert.equal(defaultLogPath('/home/x/.clawdsitter'), join('/home/x/.clawdsitter', 'log'))
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
