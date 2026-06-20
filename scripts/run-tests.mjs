// run each test file in its own node process.
// why: @lydell/node-pty spawns a conpty_console_list_agent that crashes in a
// consoleless/headless environment, and that stalls the test runner *between*
// files when everything shares one process. per-file isolation sidesteps it
// (each child fully exits and reaps its helpers). in a real terminal there's a
// console so the agent doesn't crash anyway.
import { readdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'

const dir = 'test'
const files = readdirSync(dir).filter((f) => f.endsWith('.test.js')).sort()

let totalPass = 0
let totalFail = 0
let filesFailed = 0

for (const f of files) {
  const r = spawnSync(process.execPath, ['--test', '--test-force-exit', join(dir, f)], {
    encoding: 'utf8',
  })
  const out = (r.stdout || '') + '\n' + (r.stderr || '')
  const pass = Number((out.match(/(?:#|ℹ) pass (\d+)/) || [])[1] || 0)
  const fail = Number((out.match(/(?:#|ℹ) fail (\d+)/) || [])[1] || 0)
  totalPass += pass
  totalFail += fail
  const ok = r.status === 0 && fail === 0
  if (!ok) filesFailed++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${f.padEnd(20)} pass=${pass} fail=${fail}`)
  if (!ok) {
    const detail = out
      .split('\n')
      .filter((l) => /not ok|AssertionError|Error:/.test(l) && !/AttachConsole/.test(l))
      .slice(0, 25)
    if (detail.length) console.log(detail.join('\n'))
  }
}

console.log(`\nTOTAL  pass=${totalPass} fail=${totalFail}  (files failed: ${filesFailed})`)
process.exit(filesFailed === 0 ? 0 : 1)
