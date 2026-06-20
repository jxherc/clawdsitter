import { DEFAULTS } from './config.js'

// strip ANSI/VT escape sequences so pattern matching sees plain text.
// covers CSI (\x1b[...), OSC (\x1b]...), and stray single-char escapes.
const ANSI = /\x1b\[[0-9;?]*[ -/]*[@-~]|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)|\x1b[@-Z\\-_]|[\x00-\x08\x0b\x0c\x0e-\x1f]/g

export function stripAnsi(s) {
  return String(s).replace(ANSI, '')
}

function compile(src) {
  return new RegExp(src, 'i')
}

export function classify(text, patterns = DEFAULTS.patterns) {
  const clean = stripAnsi(text)
  const limit = compile(patterns.limit)
  const transient = compile(patterns.transient)
  let m = clean.match(limit)
  if (m) return { kind: 'limit', match: m[0] }
  m = clean.match(transient)
  if (m) return { kind: 'transient', match: m[0] }
  return { kind: null }
}

// rolling watcher: classifies (carryover tail + new chunk) so a match split
// across two PTY writes is still caught. episode/dedup is the supervisor's job.
export function createWatcher({ patterns = DEFAULTS.patterns, carryover = 256 } = {}) {
  let tail = ''
  return {
    feed(chunk) {
      const clean = stripAnsi(chunk)
      const window = tail + clean
      const d = classify(window, patterns)
      if (d.kind) {
        // consume the matched region so the same error lingering in the buffer
        // doesn't re-fire on the next chunk (which would look like a recurrence)
        tail = ''
        return { ...d, text: window }
      }
      tail = window.slice(-carryover)
      return null
    },
    get tail() {
      return tail
    },
  }
}
