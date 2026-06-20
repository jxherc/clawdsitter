// parse a "resets 2:10am" style reset time out of claude's limit message
// into a concrete Date relative to `now`. returns null if there's nothing to parse.
export function parseReset(text, now) {
  const m = String(text).match(/resets\s+(\d{1,2}):(\d{2})\s*(am|pm)?/i)
  if (!m) return null

  let h = Number(m[1])
  const min = Number(m[2])
  const ap = m[3] && m[3].toLowerCase()

  if (h > 23 || min > 59) return null

  if (ap === 'pm' && h < 12) h += 12
  if (ap === 'am' && h === 12) h = 0

  const target = new Date(now)
  target.setHours(h, min, 0, 0)
  if (target.getTime() <= now.getTime()) {
    target.setDate(target.getDate() + 1)
  }
  return target
}
