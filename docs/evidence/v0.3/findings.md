# v0.3 audit — Reset-time parser

## Area state
New pure module. When the detector says `limit`, the supervisor needs to know *when* to wake up.
Claude prints the reset wall-clock time, e.g. `resets 2:10am`. We parse that into a concrete
`Date` relative to `now`, rolling to tomorrow if the time already passed today.

## Real input
`You've hit your session limit · resets 2:10am (Asia/Shanghai)` — note: 12h clock with `am/pm`,
a `·` separator, and a parenthesised timezone we deliberately ignore (local clock == that tz here).

## Edge cases to cover
- future time today vs already-passed time -> tomorrow
- `am`/`pm` conversion incl. `12am`(=00) and `12pm`(=noon)
- 24h form with no am/pm
- unparseable -> `null` (supervisor falls back to a fixed wait)
- seconds zeroed; minutes/hours exact

## Bugs / imperfections found
None yet.
