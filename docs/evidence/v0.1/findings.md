# v0.1 audit — Foundations (config + log)

## Area state
Greenfield. No source exists before this microversion beyond scaffolding
(`package.json`, `ROADMAP.md`, `progress.json`, `check_progress.py`). Nothing to "run"
yet — the audit here is establishing the requirements + the real-world inputs the units
must handle.

## Real-world inputs this layer must handle (captured from `.claude-warmer/warm.log`)
- Log lines in the existing house style: `2026-06-20 00:55:37  exit=1  <msg>` — clawdsitter
  mirrors `TIMESTAMP  <event>  <msg>`.
- Config must accept human duration strings for backoff (`"10s"`, `"30s"`, `"1m"`, `"5m"`,
  `"10m"`) since that's how the roadmap/plan express the backoff schedule.

## Requirements exercised by tests
- `loadConfig` returns DEFAULTS when no user file; deep-merges a partial user file over
  defaults (incl. nested `notify`/`patterns`); honors a `home` override (env `CLAWDSITTER_HOME`).
- `parseDuration` converts `s/m/h/ms` suffixes and bare numbers (ms) to milliseconds; rejects junk.
- `createLog` appends single-line entries with a timestamp, creates the parent dir, sanitizes
  embedded newlines, and trims the file to the last N lines (default 500).

## Bugs / imperfections found
None yet — building from scratch. Anything found during regression gets logged here.
