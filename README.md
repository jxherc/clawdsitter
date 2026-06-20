# clawdsitter

Overnight babysitter for [Claude Code](https://claude.com/claude-code). You leave a long session
running, go to bed, and a network blip or a usage-limit no longer wastes the hours you're asleep.

Instead of `claude`, you run `clawdsitter claude`. It hosts Claude inside a pseudo-terminal it
owns and passes the whole TUI straight through — you use Claude exactly as normal. It just watches
the output, and when something goes wrong it quietly recovers:

- **Transient API / network errors** (`API Error: Unable to connect...`, cert flaps, 5xx, the
  flapping proxy 401s) → retries with backoff `10s → 30s → 1m → 5m → 10m`, injecting your resume
  phrase each step until Claude is going again, or gives up after the last step.
- **Session / usage limit** (`You've hit your session limit · resets 2:10am`) → parses the reset
  time, waits until just after it, then resumes. Survives multiple 5-hour windows.

It writes directly to Claude's stdin, so it never depends on window focus — no risk of typing
`continue` into the wrong window while you sleep.

## Install

```sh
git clone <repo> clawdsitter && cd clawdsitter
npm install
npm link        # puts `clawdsitter` on your PATH
```

## Use

```sh
clawdsitter claude                 # wrap a normal session
clawdsitter claude --resume <id>   # any claude args pass straight through
clawdsitter                        # defaults to the `claude` command
clawdsitter --help | --version
```

## Config — `~/.clawdsitter/config.json` (all optional)

```jsonc
{
  "claudeCommand": "claude",
  "resumePhrase": "continue",            // what to send to resume; make it anything
  "backoffSteps": ["10s","30s","1m","5m","10m"],
  "resetGraceSeconds": 60,               // wait this long past the reset time
  "healObserveSeconds": 30,              // after a retry, watch this long for the error to recur
  "fallbackWaitMinutes": 60,             // used if a limit message has no parseable reset time
  "maxResumes": 0,                       // 0 = unlimited limit-resumes
  "injectDelayMs": 750,                  // settle delay before typing
  "patterns": { "transient": "<regex>", "limit": "<regex>" },  // override if wording drifts
  "notify": { "toast": true }
}
```

Activity is logged to `~/.clawdsitter/log` and key events (resumed / gave up) fire a desktop toast.

## Develop

```sh
npm test        # full suite (each file isolated; see scripts/run-tests.mjs for the why)
```

Built one microversion at a time — see `ROADMAP.md`, `progress.json`, `docs/plans/`,
`docs/evidence/`.
