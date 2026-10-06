export function createRequestTracker() {
  let pending = 0
  const listeners = new Set<() => void>()
  const notify = () => listeners.forEach((listener) => listener())
  return {
    snapshot: () => pending,
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    begin() {
      pending += 1
      notify()
      let finished = false
      return () => {
        if (finished) return
        finished = true
        pending -= 1
        notify()
      }
    },
  }
}

export const requestTracker = createRequestTracker()

export function installRequestTracking() {
  const originalFetch = window.fetch.bind(window)
  window.fetch = async (...args) => {
    const finish = requestTracker.begin()
    try {
      return await originalFetch(...args)
    } finally {
      finish()
    }
  }
  const originalSend = XMLHttpRequest.prototype.send
  XMLHttpRequest.prototype.send = function (body) {
    const finish = requestTracker.begin()
    const complete = () => {
      this.removeEventListener("loadend", complete)
      finish()
    }
    this.addEventListener("loadend", complete, { once: true })
    try {
      originalSend.call(this, body)
    } catch (error) {
      complete()
      throw error
    }
  }
}
