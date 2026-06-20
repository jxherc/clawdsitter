# clawdsitter — ROADMAP

Overnight babysitter for Claude Code. Wraps `claude` in a ConPTY (`clawdsitter claude ...`),
passes the TUI through transparently, watches the output stream, and auto-recovers from
transient API/network errors (backoff retry) and session/usage limits (wait for reset, resume).

Built one **microversion** at a time, depth-first: fully finish + test each before the next.
Each microversion: audit the area (evidence in `docs/evidence/<v>/`), plan tasks in
`docs/plans/<v>.md` (>=8 tests each), strict TDD (RED → GREEN → lint), update `progress.json`.
After each: full regression with real varied input, fix everything, then continue.
Done when `python check_progress.py` returns 0 with a clean final regression.

## Microversions

### v0.1 — Foundations (config + log)
Project skeleton, config loader (DEFAULTS merged over `~/.clawdsitter/config.json`, with
duration string parsing like `"10s"`/`"1m"`), and the append-only text log (`~/.clawdsitter/log`,
trimmed to last 500 lines). Pure-ish, fully unit-tested.

### v0.2 — Detector
`classify(text)` pure function over ANSI-stripped text → `{kind:'transient'|'limit'|null}`.
Config-overridable regex. Built and tested against the real captured Claude strings.

### v0.3 — Reset-time parser
`parseReset(text, now)` pure function → `Date|null` from `resets 2:10am` style messages.
Today-vs-tomorrow rollover, am/pm, garbage → null.

### v0.4 — Supervisor (state machine)
Backoff retry + wait-for-reset orchestration with all side-effects injected
(`inject`, `sleep`, `notify`, `now`, `log`). Idempotency / episode handling. maxResumes cap.

### v0.5 — PTY host + notifications
`ptyHost` spawns claude in ConPTY, transparent stdio passthrough, resize, exposes `write()`.
`notify` toast via node-notifier, gated by config. Smoke-tested.

### v0.6 — CLI wiring + end-to-end
`index.js` + `bin.js` wire everything; arg parsing; `fake-claude.js` harness; both recovery
paths proven end-to-end through a real PTY.

## Out of scope (YAGNI)
- Multi-agent (codex/gemini) — Claude-only.
- Attaching to running sessions / keystroke injection.
- Sound alerts, push notifications, GUI.
