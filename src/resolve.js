import { existsSync } from 'node:fs'
import { delimiter, extname, isAbsolute, join } from 'node:path'

// node-pty on windows needs a real executable path (it won't search PATH like
// child_process does), and a .cmd/.bat shim (how npm installs `claude`) must run
// through cmd.exe. resolveCommand turns a bare command into { file, args } ready
// for pty.spawn(file, [...args, ...userArgs]).
export function resolveCommand(command, opts = {}) {
  const {
    env = process.env,
    platform = process.platform,
    exists = existsSync,
    comspec = process.env.COMSPEC || 'cmd.exe',
  } = opts
  const isWin = platform === 'win32'

  // already a path that exists -> use directly
  if ((isAbsolute(command) || command.includes('/') || command.includes('\\')) && exists(command)) {
    return wrap(command, isWin, comspec)
  }

  // search PATH (+ PATHEXT on windows)
  const exts = isWin ? (env.PATHEXT || '.COM;.EXE;.BAT;.CMD').split(';') : ['']
  const dirs = (env.PATH || env.Path || '').split(delimiter).filter(Boolean)
  const hasExt = extname(command) !== ''
  for (const d of dirs) {
    for (const ext of hasExt ? [''] : ['', ...exts]) {
      const candidate = join(d, command + ext)
      if (exists(candidate)) return wrap(candidate, isWin, comspec)
    }
  }

  // not found: hand it back as-is so spawn fails with a clear error
  return { file: command, args: [] }
}

function wrap(file, isWin, comspec) {
  const ext = extname(file).toLowerCase()
  if (isWin && (ext === '.cmd' || ext === '.bat')) {
    return { file: comspec, args: ['/c', file] }
  }
  return { file, args: [] }
}
