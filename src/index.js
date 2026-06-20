import { loadConfig, configHome } from './config.js'
import { createLog, defaultLogPath } from './log.js'
import { createNotifier } from './notify.js'
import { createWatcher } from './detector.js'
import { createSupervisor } from './supervisor.js'
import { createPtyHost } from './ptyHost.js'
import { resolveCommand } from './resolve.js'

export const VERSION = '0.1.0'

export function parseArgs(argv) {
  if (argv.includes('--help') || argv.includes('-h')) return { help: true, args: [] }
  if (argv.includes('--version') || argv.includes('-v')) return { version: true, args: [] }
  const [command = null, ...rest] = argv
  return { command, args: rest }
}

// the PTY data handler: route detector verdicts to the supervisor.
export function makeOnData({ watcher, supervisor }) {
  return (chunk) => {
    const d = watcher.feed(chunk)
    if (!d) return null
    if (supervisor.busy) {
      supervisor.signalError()
      return 'signal'
    }
    if (d.kind === 'limit') {
      supervisor.handleLimit(d.text ?? chunk)
      return 'limit'
    }
    supervisor.handleTransient()
    return 'transient'
  }
}

export function createApp({
  config,
  command,
  args = [],
  stdout = process.stdout,
  stdin = process.stdin,
  sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
  now = () => new Date(),
  log = () => {},
  notify = () => {},
  spawn,
}) {
  const watcher = createWatcher({ patterns: config.patterns })
  // host is referenced by inject; it's assigned right below before any async inject runs
  let host
  const supervisor = createSupervisor({
    config,
    sleep,
    now,
    inject: (s) => host.write(s),
    log,
    notify,
  })
  const onData = makeOnData({ watcher, supervisor })
  // node-pty needs a real exe path (and cmd.exe for .cmd shims like `claude`)
  const resolved = resolveCommand(command)
  host = createPtyHost({ command: resolved.file, args: [...resolved.args, ...args], stdout, stdin, spawn, onData })
  return { host, supervisor, watcher }
}

function printHelp() {
  process.stdout.write(`clawdsitter ${VERSION} - overnight babysitter for claude code

usage:
  clawdsitter [claude-command] [args...]    wrap & watch a claude session
  clawdsitter                                wrap the default 'claude' command
  clawdsitter --help | --version

config: ~/.clawdsitter/config.json   log: ~/.clawdsitter/log
`)
}

export async function main(argv = process.argv.slice(2)) {
  const parsed = parseArgs(argv)
  if (parsed.help) {
    printHelp()
    return 0
  }
  if (parsed.version) {
    process.stdout.write(VERSION + '\n')
    return 0
  }

  const config = loadConfig()
  const home = configHome()
  const logger = createLog(defaultLogPath(home))
  const notifier = createNotifier(config)
  const command = parsed.command || config.claudeCommand

  const app = createApp({
    config,
    command,
    args: parsed.args,
    log: (e, m) => logger.append(e, m),
    notify: (t, m) => notifier.toast(t, m),
  })
  logger.append('start', `watching: ${command} ${parsed.args.join(' ')}`.trim())

  return new Promise((resolve) => {
    app.host.onExit((e) => {
      const code = e?.exitCode ?? 0
      logger.append('exit', `child exited code=${code}`)
      resolve(code)
    })
  })
}
