import { test } from 'node:test'
import assert from 'node:assert/strict'
import { join, delimiter } from 'node:path'

import { resolveCommand } from '../src/resolve.js'

// mock filesystem: a set of paths that "exist"
function mkExists(paths) {
  const set = new Set(paths)
  return (p) => set.has(p)
}

const WINENV = { PATH: ['C:\\bin', 'C:\\tools'].join(';'), PATHEXT: '.EXE;.CMD;.BAT' }
const NIXENV = { PATH: ['/usr/bin', '/usr/local/bin'].join(delimiter) }

test('absolute existing path passes through unchanged', () => {
  const p = 'C:\\Program Files\\nodejs\\node.exe'
  const r = resolveCommand(p, { platform: 'win32', exists: mkExists([p]) })
  assert.equal(r.file, p)
  assert.deepEqual(r.args, [])
})

test('bare name resolves via PATH to an .EXE on windows', () => {
  const target = join('C:\\bin', 'node.EXE')
  const r = resolveCommand('node', { platform: 'win32', env: WINENV, exists: mkExists([target]) })
  assert.equal(r.file, target)
  assert.deepEqual(r.args, [])
})

test('.cmd shim is wrapped through cmd.exe', () => {
  const target = join('C:\\tools', 'claude.CMD')
  const r = resolveCommand('claude', {
    platform: 'win32',
    env: WINENV,
    exists: mkExists([target]),
    comspec: 'C:\\Windows\\System32\\cmd.exe',
  })
  assert.equal(r.file, 'C:\\Windows\\System32\\cmd.exe')
  assert.deepEqual(r.args, ['/c', target])
})

test('PATHEXT order is respected (.EXE found before .CMD when both exist)', () => {
  const exe = join('C:\\bin', 'claude.EXE')
  const cmd = join('C:\\bin', 'claude.CMD')
  const r = resolveCommand('claude', { platform: 'win32', env: WINENV, exists: mkExists([exe, cmd]) })
  assert.equal(r.file, exe) // .EXE comes first in PATHEXT
  assert.deepEqual(r.args, [])
})

test('not found returns the command as-is for a clear spawn error', () => {
  const r = resolveCommand('nope', { platform: 'win32', env: WINENV, exists: mkExists([]) })
  assert.equal(r.file, 'nope')
  assert.deepEqual(r.args, [])
})

test('non-windows resolves a bare executable on PATH', () => {
  const target = join('/usr/local/bin', 'claude')
  const r = resolveCommand('claude', { platform: 'linux', env: NIXENV, exists: mkExists([target]) })
  assert.equal(r.file, target)
  assert.deepEqual(r.args, [])
})

test('explicit extension is honored and not double-suffixed', () => {
  const target = join('C:\\bin', 'thing.bat')
  const r = resolveCommand('thing.bat', { platform: 'win32', env: WINENV, exists: mkExists([target]) })
  assert.equal(r.file, process.env.COMSPEC || 'cmd.exe')
  assert.deepEqual(r.args, ['/c', target])
})
