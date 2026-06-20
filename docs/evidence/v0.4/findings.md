# v0.4 audit — Supervisor (state machine)

## Area state
New module — the orchestration core. Consumes detector verdicts and drives recovery while the
user sleeps. ALL side-effects (inject keystrokes, sleep, notify, log, current time) are injected
so the logic is deterministically unit-testable with a manual clock (no real waiting, no PTY).

## Behaviors
- **transient** → backoff `[10s,30s,1m,5m,10m]`: each step → wait → inject resume phrase → watch
  `healObserveSeconds` for the error to recur. No recurrence ⇒ resumed (stop early, don't spam
  `continue`). Recurs through all steps ⇒ give up (stay passive, leave on screen). log + toast.
- **limit** → parse reset time (fallback to `fallbackWaitMinutes` if unparseable), sleep until
  `reset + resetGraceSeconds`, inject once. `maxResumes` cap (0 = unlimited) guards runaway loops.
- **busy guard / episode idempotency**: only one recovery runs at a time; re-entrant calls return
  `'busy'`, so the same error redrawn by the TUI fires one recovery, not many.

## Why early-stop matters (failure mode being prevented)
Without heal-detection the loop would inject `continue` at every backoff step even after the
first one worked → 5 stacked prompts. The observation window prevents that.

## Bugs / imperfections found
None yet.
