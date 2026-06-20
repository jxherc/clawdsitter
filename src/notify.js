import notifier from 'node-notifier'

// thin toast wrapper. gated by config.notify.toast (default on). never throws —
// a busted notifier must not take down an overnight session.
export function createNotifier(config = {}, lib = notifier) {
  const enabled = config?.notify?.toast !== false
  return {
    enabled,
    toast(title, message) {
      if (!enabled) return false
      try {
        lib.notify({ title, message })
      } catch {
        // ignore - best effort only
      }
      return true
    },
  }
}
