import { test } from 'node:test'
import assert from 'node:assert/strict'

import { parseReset } from '../src/resetTime.js'

// June 20 2026, 01:00:00 local
const at = (h, m, s = 0) => new Date(2026, 5, 20, h, m, s)

test('future time today stays today', () => {
  const d = parseReset('resets 2:10am', at(1, 0))
  assert.equal(d.getFullYear(), 2026)
  assert.equal(d.getDate(), 20)
  assert.equal(d.getHours(), 2)
  assert.equal(d.getMinutes(), 10)
})

test('already-passed time rolls to tomorrow', () => {
  const d = parseReset('resets 2:10am', at(3, 0))
  assert.equal(d.getDate(), 21)
  assert.equal(d.getHours(), 2)
  assert.equal(d.getMinutes(), 10)
})

test('pm afternoon converts to 24h', () => {
  const d = parseReset('resets 2:10pm', at(1, 0))
  assert.equal(d.getDate(), 20)
  assert.equal(d.getHours(), 14)
  assert.equal(d.getMinutes(), 10)
})

test('12am maps to midnight hour 0', () => {
  const d = parseReset('resets 12:30am', at(0, 5))
  assert.equal(d.getHours(), 0)
  assert.equal(d.getMinutes(), 30)
})

test('12pm maps to noon', () => {
  const d = parseReset('resets 12:30pm', at(1, 0))
  assert.equal(d.getHours(), 12)
  assert.equal(d.getMinutes(), 30)
})

test('24h form without am/pm is taken as-is', () => {
  const d = parseReset('resets 14:05', at(1, 0))
  assert.equal(d.getHours(), 14)
  assert.equal(d.getMinutes(), 5)
})

test('parses the full real session-limit string', () => {
  const d = parseReset("You've hit your session limit · resets 2:10am (Asia/Shanghai)", at(1, 0))
  assert.equal(d.getHours(), 2)
  assert.equal(d.getMinutes(), 10)
})

test('unparseable input returns null', () => {
  assert.equal(parseReset('no time here', at(1, 0)), null)
  assert.equal(parseReset('resets soon', at(1, 0)), null)
  assert.equal(parseReset('', at(1, 0)), null)
})

test('seconds are zeroed', () => {
  const d = parseReset('resets 2:10am', at(1, 0, 45))
  assert.equal(d.getSeconds(), 0)
})

test('now exactly equal to target rolls to tomorrow', () => {
  const d = parseReset('resets 2:10am', at(2, 10, 0))
  assert.equal(d.getDate(), 21)
})
