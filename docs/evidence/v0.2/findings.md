# v0.2 audit — Detector

## Area state
New module. The detector is the heart of recovery: it must correctly classify Claude Code's
real terminal output into `transient` (retry), `limit` (wait for reset), or `null` (do nothing).
False positives are dangerous (would inject `continue` mid-work); false negatives waste the night.

## Real captured Claude/proxy output to classify (from `.claude-warmer/warm.log`)
- `Failed to authenticate. API Error: 401 ...`            -> transient (flapping proxy, self-heals)
- `API Error: Unable to connect to API (UNKNOWN_CERTIFICATE_VERIFICATION_ERROR)` -> transient
- `You've hit your session limit · resets 2:10am (Asia/Shanghai)`  -> limit
- normal tool output / spinner / prose                    -> null

## Things to get right
- ANSI escape codes wrap real TUI output — must strip before matching.
- A match can be split across two PTY chunks — watcher keeps a small carryover tail.
- `limit` takes precedence over `transient` if both somehow match.
- Patterns must be overridable from config (wording drifts between Claude versions).

## Bugs / imperfections found
None yet. Regression findings appended below as they appear.
