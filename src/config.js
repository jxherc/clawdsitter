import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

// default regex sources, kept as strings so they're easy to override in config.json
const TRANSIENT = 'API Error|Unable to connect|UNKNOWN_CERTIFICATE|ECONNRESET|fetch failed|overloaded|\\b(429|5\\d\\d)\\b'
const LIMIT = 'hit your (session|usage) limit|resets\\s+\\d{1,2}:\\d{2}\\s*(am|pm)?'

export const DEFAULTS = {
  claudeCommand: 'claude',
  resumePhrase: 'continue',
  backoffSteps: ['10s', '30s', '1m', '5m', '10m'],
  resetGraceSeconds: 60,
  healObserveSeconds: 30,  // after a retry, watch this long for the error to recur
  fallbackWaitMinutes: 60,
  maxResumes: 0,            // 0 = unlimited
  injectDelayMs: 750,
  patterns: { transient: TRANSIENT, limit: LIMIT },
  notify: { toast: true },
}

const UNITS = { ms: 1, s: 1000, m: 60000, h: 3600000 }

export function parseDuration(v) {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v !== 'string') throw new Error(`bad duration: ${v}`)
  const s = v.trim()
  if (s === '') throw new Error('empty duration')
  // bare number -> ms
  if (/^\d+(\.\d+)?$/.test(s)) return Number(s)
  const m = s.match(/^(\d+(?:\.\d+)?)\s*(ms|s|m|h)$/i)
  if (!m) throw new Error(`bad duration: ${v}`)
  return Number(m[1]) * UNITS[m[2].toLowerCase()]
}

export function configHome() {
  return process.env.CLAWDSITTER_HOME || join(homedir(), '.clawdsitter')
}

// shallow-ish deep merge: objects merge recursively, everything else overwrites
function merge(base, over) {
  const out = Array.isArray(base) ? [...base] : { ...base }
  for (const k of Object.keys(over || {})) {
    const a = out[k], b = over[k]
    if (a && b && typeof a === 'object' && typeof b === 'object' && !Array.isArray(a) && !Array.isArray(b)) {
      out[k] = merge(a, b)
    } else {
      out[k] = b
    }
  }
  return out
}

export function loadConfig({ home } = {}) {
  const dir = home || configHome()
  let user = {}
  try {
    user = JSON.parse(readFileSync(join(dir, 'config.json'), 'utf8'))
  } catch {
    // no file or junk -> just use defaults, don't blow up an overnight run
    user = {}
  }
  return merge(DEFAULTS, user)
}
