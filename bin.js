#!/usr/bin/env node
import { main } from './src/index.js'

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    // last-ditch: don't swallow startup failures silently
    process.stderr.write(`clawdsitter: ${err?.stack || err}\n`)
    process.exit(1)
  })
