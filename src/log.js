import { appendFileSync, mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'

export function defaultLogPath(home) {
  return join(home, 'log')
}

function stamp(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

export function createLog(logPath, { maxLines = 500 } = {}) {
  mkdirSync(dirname(logPath), { recursive: true })

  function append(event, msg) {
    const clean = String(msg ?? '').replace(/[\r\n]+/g, ' ').trim()
    appendFileSync(logPath, `${stamp()}  ${event}  ${clean}\n`)
    trim()
  }

  function trim() {
    if (!existsSync(logPath)) return
    const all = readFileSync(logPath, 'utf8').split('\n')
    // last element is usually '' from the trailing newline
    const content = all[all.length - 1] === '' ? all.slice(0, -1) : all
    if (content.length <= maxLines) return
    writeFileSync(logPath, content.slice(-maxLines).join('\n') + '\n')
  }

  return { append, path: logPath }
}
