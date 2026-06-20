import pty from '@lydell/node-pty'

// hosts `claude` (or anything) in a ConPTY, passes the TUI through transparently,
// and exposes a write() the supervisor uses to inject the resume phrase.
export function createPtyHost({
  command,
  args = [],
  cwd = process.cwd(),
  env = process.env,
  cols,
  rows,
  onData = () => {},
  stdin = process.stdin,
  stdout = process.stdout,
  spawn = (cmd, a, o) => pty.spawn(cmd, a, o),
} = {}) {
  const child = spawn(command, args, {
    name: 'xterm-256color',
    cols: cols || stdout.columns || 80,
    rows: rows || stdout.rows || 30,
    cwd,
    env,
  })

  const exitCbs = []
  let restored = false

  child.onData((d) => {
    stdout.write(d)
    onData(d)
  })

  // user keystrokes -> child
  const onStdin = (d) => child.write(typeof d === 'string' ? d : d.toString('utf8'))
  let rawSet = false
  if (stdin.isTTY && stdin.setRawMode) {
    stdin.setRawMode(true)
    rawSet = true
  }
  stdin.resume?.()
  stdin.on('data', onStdin)

  const onResize = () => {
    try {
      child.resize(stdout.columns || 80, stdout.rows || 30)
    } catch {
      // window race during teardown - ignore
    }
  }
  stdout.on?.('resize', onResize)

  function restore() {
    if (restored) return
    restored = true
    stdin.off?.('data', onStdin)
    if (rawSet && stdin.setRawMode) stdin.setRawMode(false)
    stdin.pause?.()
    stdout.off?.('resize', onResize)
  }

  child.onExit((e) => {
    restore()
    exitCbs.forEach((cb) => cb(e))
  })

  return {
    write: (d) => child.write(d),
    resize: (c, r) => child.resize(c, r),
    kill: (sig) => child.kill(sig),
    onExit: (cb) => exitCbs.push(cb),
    restore,
    get pid() {
      return child.pid
    },
  }
}
