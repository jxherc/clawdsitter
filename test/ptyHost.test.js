import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PassThrough } from 'node:stream'

import { createPtyHost } from '../src/ptyHost.js'
import { stripAnsi } from '../src/detector.js'

// ---- fakes for deterministic wiring tests ----
function fakeChild() {
  const dataCbs = []
  const exitCbs = []
  return {
    pid: 4242,
    writes: [],
    resizes: [],
    killed: [],
    onData(cb) { dataCbs.push(cb) },
    onExit(cb) { exitCbs.push(cb) },
    write(d) { this.writes.push(d) },
    resize(c, r) { this.resizes.push([c, r]) },
    kill(s) { this.killed.push(s) },
    _data(d) { dataCbs.forEach((cb) => cb(d)) },
    _exit(e) { exitCbs.forEach((cb) => cb(e)) },
  }
}

function fakeIO(extra = {}) {
  return {
    columns: 120,
    rows: 40,
    written: [],
    handlers: {},
    write(d) { this.written.push(d); return true },
    on(ev, cb) { (this.handlers[ev] ??= []).push(cb) },
    off(ev, cb) { this.handlers[ev] = (this.handlers[ev] || []).filter((h) => h !== cb) },
    emit(ev, ...a) { (this.handlers[ev] || []).forEach((cb) => cb(...a)) },
    resume() {},
    pause() {},
    ...extra,
  }
}

function setup(opts = {}) {
  const child = fakeChild()
  let spawnArgs = null
  const spawn = (command, args, o) => {
    spawnArgs = { command, args, o }
    return child
  }
  const stdout = fakeIO()
  const stdin = fakeIO(opts.stdin)
  const onData = []
  const host = createPtyHost({
    command: 'claude',
    args: ['--foo'],
    stdout,
    stdin,
    spawn,
    onData: (d) => onData.push(d),
    ...opts.hostOpts,
  })
  return { child, spawnArgs, stdout, stdin, onData, host }
}

test('spawns the command/args sized to stdout', () => {
  const { spawnArgs } = setup()
  assert.equal(spawnArgs.command, 'claude')
  assert.deepEqual(spawnArgs.args, ['--foo'])
  assert.equal(spawnArgs.o.cols, 120)
  assert.equal(spawnArgs.o.rows, 40)
})

test('child output goes to stdout and to onData', () => {
  const { child, stdout, onData } = setup()
  child._data('hello world')
  assert.deepEqual(stdout.written, ['hello world'])
  assert.deepEqual(onData, ['hello world'])
})

test('write() delegates to child.write', () => {
  const { child, host } = setup()
  host.write('continue\r')
  assert.deepEqual(child.writes, ['continue\r'])
})

test('resize() delegates to child.resize', () => {
  const { child, host } = setup()
  host.resize(100, 50)
  assert.deepEqual(child.resizes, [[100, 50]])
})

test('stdin data is forwarded to child', () => {
  const { child, stdin } = setup()
  stdin.emit('data', Buffer.from('xy'))
  assert.equal(child.writes.length, 1)
  assert.match(child.writes[0], /xy/)
})

test('stdout resize event triggers child.resize', () => {
  const { child, stdout } = setup()
  stdout.columns = 77
  stdout.rows = 33
  stdout.emit('resize')
  assert.deepEqual(child.resizes.at(-1), [77, 33])
})

test('onExit fires registered callbacks and restore detaches stdin', () => {
  const { child, stdin, host } = setup()
  let exited = null
  host.onExit((e) => { exited = e })
  child._exit({ exitCode: 0 })
  assert.deepEqual(exited, { exitCode: 0 })
  // after exit, stdin 'data' should no longer reach the child
  const before = child.writes.length
  stdin.emit('data', Buffer.from('zz'))
  assert.equal(child.writes.length, before)
})

test('raw mode is set on a TTY stdin and restored on exit', () => {
  const raw = []
  const { child } = setup({ stdin: { isTTY: true, setRawMode: (v) => raw.push(v) } })
  assert.deepEqual(raw, [true])
  child._exit({ exitCode: 0 })
  assert.deepEqual(raw, [true, false])
})

test('pid is exposed', () => {
  const { host } = setup()
  assert.equal(host.pid, 4242)
})

// ---- real PTY smoke tests ----
function realRun(args, { send, afterMs = 350 } = {}) {
  return new Promise((resolve, reject) => {
    const out = new PassThrough()
    let text = ''
    out.on('data', (d) => { text += d.toString() })
    out.columns = 80
    out.rows = 24
    const inp = new PassThrough()
    let host
    try {
      host = createPtyHost({ command: process.execPath, args, stdout: out, stdin: inp })
    } catch (e) {
      return reject(e)
    }
    const killer = setTimeout(() => { try { host.kill() } catch {} ; resolve({ text, timedOut: true }) }, 6000)
    host.onExit(() => { clearTimeout(killer); resolve({ text }) })
    if (send !== undefined) setTimeout(() => host.write(send), afterMs)
  })
}

test('real PTY: passes child output through to stdout', async () => {
  const { text } = await realRun(['-e', 'process.stdout.write("hi-there-123")'])
  assert.match(stripAnsi(text), /hi-there-123/)
})

test('real PTY: write() reaches the child stdin', async () => {
  const script = 'process.stdin.on("data",d=>{process.stdout.write("GOT["+d.toString().replace(/[\\r\\n]/g,"")+"]");process.exit(0)})'
  const { text } = await realRun(['-e', script], { send: 'ping\r' })
  assert.match(stripAnsi(text), /GOT\[ping\]/)
})
