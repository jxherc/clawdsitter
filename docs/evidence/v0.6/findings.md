# v0.6 audit — CLI wiring + end-to-end

## Area state
Final microversion: assemble config+log+notify+detector+supervisor+ptyHost into a working CLI,
and prove both recovery paths drive a REAL child through a REAL ConPTY.

## Wiring contract (the glue being added)
- `parseArgs(argv)` → `{ command, args, help?, version? }`. `clawdsitter claude --resume x` →
  command `claude`, args `[--resume, x]`. No command → fall back to `config.claudeCommand`.
- `makeOnData({watcher, supervisor})` → the PTY data handler:
  - `watcher.feed(chunk)` → detection or null
  - if a recovery is already running (`supervisor.busy`) → `signalError()` (error recurred)
  - else `limit` → `handleLimit(detection.text)`, `transient` → `handleTransient()`
- `createApp(...)` builds watcher+supervisor+ptyHost and returns them; `main()` wires real
  process streams, real `sleep`, logger and notifier, then resolves with the child's exit code.

## Real-PTY end-to-end (the actual proof)
`test/fake-claude.js` stands in for claude: prints a chosen error/limit line, then on the first
real stdin nudge prints `RESUMED:<phrase>` and exits. With tiny backoff timings the e2e test
asserts clawdsitter injected the configured phrase and the child resumed — through ConPTY.

## Gotcha already found & fixed (v0.5 carryover)
`node --test` hangs on exit because node-pty keeps a libuv handle open; piped TAP output then
never flushes (looked like a hang with empty output). Fixed by adding `--test-force-exit` to the
`test` script. Documented here so future me doesn't re-debug it.

## Bugs found during final regression (running the REAL bin.js, not just the API)

1. **`File not found` on spawn** — node-pty (Windows) does NOT search PATH; a bare command
   (`claude`, `node`) fails. `clawdsitter claude` would have been dead on arrival.
   Fix: `src/resolve.js` resolves the command via PATH/PATHEXT and wraps `.cmd`/`.bat` shims
   (how npm installs `claude`) through `cmd.exe /c`. Wired into `createApp`. + `resolve.test.js`.

2. **False `gave-up` after a successful recovery** — the stale error text lingered in the
   watcher's 256-char carryover, so after injecting `continue` it re-matched during the observe
   window and looked like a recurrence. Real log showed `gave-up` even though the child resumed.
   Fix: `createWatcher` now clears its tail once a detection fires, so the same occurrence can't
   re-trigger. + regression test "does not re-fire on stale error left in the buffer".

Both reproduced via the real `bin.js` smoke against `fake-claude.js`, fixed, and re-verified.

## Final regression result
See `regression.txt` (full per-file suite) and `bin-smoke.txt` (real binary run + log).
