// stand-in for the real `claude` TUI, used by the e2e tests.
// prints a chosen error/limit line, then on the first real stdin nudge
// prints RESUMED:<what-it-got> and exits. `idle` just stays up until killed.
const mode = process.argv[2] || 'idle'

const lines = {
  transient: 'API Error: Unable to connect to API (UNKNOWN_CERTIFICATE_VERIFICATION_ERROR)',
  limit: "You've hit your usage limit, try again later",
  'limit-time': "You've hit your session limit · resets 2:10am (Asia/Shanghai)",
  idle: 'READY: idle fake claude',
}
process.stdout.write((lines[mode] || lines.idle) + '\n')

process.stdin.on('data', (d) => {
  const s = d.toString().replace(/[\r\n]+/g, '').trim()
  if (s.length) {
    process.stdout.write('RESUMED:' + s + '\n')
    process.exit(0)
  }
})
