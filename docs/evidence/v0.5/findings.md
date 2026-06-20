# v0.5 audit — PTY host + notifications

## Area state
New modules touching the real terminal. Verified `@lydell/node-pty` loads and spawns on this
Windows box:

```
captured: "[?9001h...[HPTYOK]0;...node.exe[?25h"  -> SPAWN_WORKS
```

So ConPTY wraps child output in escape sequences (cursor/title/altscreen) — confirms the watcher
must `stripAnsi` before matching (it does, v0.2).

## ptyHost responsibilities
- spawn the claude command in ConPTY sized to the real stdout
- transparent passthrough: child output → stdout AND → onData (watcher hook); user stdin → child
- expose `write()` (the supervisor's inject path), `resize()`, `kill()`, `onExit()`, `pid`
- raw-mode the TTY and restore it on exit (so Ctrl-C/arrows reach claude, terminal isn't left broken)

## notify responsibilities
- `toast(title,msg)` via node-notifier, gated by `config.notify.toast`; swallow toast errors
  (a broken notifier must never crash an overnight run)

## Test strategy
Wiring is unit-tested with an injected fake `spawn`/fake IO (deterministic, no native needed for
logic); two real-PTY smoke tests prove passthrough + write end-to-end. notify uses a fake lib.

## Bugs / imperfections found
None yet.
