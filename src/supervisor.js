import { parseDuration } from './config.js'
import { parseReset } from './resetTime.js'

// orchestrates recovery. every side-effect is injected so this is pure logic.
export function createSupervisor(deps) {
  const { config, inject, sleep, notify = () => {}, log = () => {}, now = () => new Date() } = deps

  const steps = config.backoffSteps.map(parseDuration)
  const graceMs = (config.resetGraceSeconds ?? 60) * 1000
  const observeMs = (config.healObserveSeconds ?? 30) * 1000
  const injectDelayMs = config.injectDelayMs ?? 0
  const fallbackMs = (config.fallbackWaitMinutes ?? 60) * 60000
  const phrase = config.resumePhrase ?? 'continue'
  const maxResumes = config.maxResumes ?? 0

  let busy = false
  let errorSinceInject = false
  let limitResumes = 0

  function signalError() {
    errorSinceInject = true
  }

  async function settleInject() {
    if (injectDelayMs > 0) await sleep(injectDelayMs)
    inject(phrase + '\r')
  }

  async function handleTransient() {
    if (busy) return 'busy'
    busy = true
    try {
      for (let i = 0; i < steps.length; i++) {
        await sleep(steps[i])
        errorSinceInject = false
        await settleInject()
        log('retry', `transient attempt ${i + 1}/${steps.length}`)
        await sleep(observeMs)
        if (!errorSinceInject) {
          log('resumed', `recovered after ${i + 1} attempt(s)`)
          notify('clawdsitter', `resumed after ${i + 1} retr${i === 0 ? 'y' : 'ies'}`)
          return 'resumed'
        }
      }
      log('gave-up', `still failing after ${steps.length} retries`)
      notify('clawdsitter', `gave up after ${steps.length} retries`)
      return 'gave-up'
    } finally {
      busy = false
    }
  }

  async function handleLimit(text) {
    if (busy) return 'busy'
    busy = true
    try {
      if (maxResumes > 0 && limitResumes >= maxResumes) {
        log('gave-up', `maxResumes (${maxResumes}) reached`)
        notify('clawdsitter', `hit maxResumes cap (${maxResumes})`)
        return 'gave-up'
      }
      const t0 = now()
      const target = parseReset(text, t0) ?? new Date(t0.getTime() + fallbackMs)
      const waitMs = Math.max(0, target.getTime() - t0.getTime()) + graceMs
      log('limit', `waiting ~${Math.round(waitMs / 1000)}s for usage reset + grace`)
      await sleep(waitMs)
      errorSinceInject = false
      await settleInject()
      limitResumes++
      log('resumed', `resumed after usage limit (#${limitResumes})`)
      notify('clawdsitter', 'resumed after usage limit')
      return 'resumed'
    } finally {
      busy = false
    }
  }

  return {
    handleTransient,
    handleLimit,
    signalError,
    get busy() {
      return busy
    },
    get limitResumes() {
      return limitResumes
    },
  }
}
