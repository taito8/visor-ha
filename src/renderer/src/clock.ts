import { useEffect, useState } from 'preact/hooks'

// Un solo intervalo para todos los relojes de los tiles.
const listeners = new Set<(now: Date) => void>()
let interval: ReturnType<typeof setInterval> | undefined

function subscribe(cb: (now: Date) => void): () => void {
  listeners.add(cb)
  interval ??= setInterval(() => {
    const now = new Date()
    listeners.forEach((l) => l(now))
  }, 1000)
  return () => {
    listeners.delete(cb)
    if (listeners.size === 0) {
      clearInterval(interval)
      interval = undefined
    }
  }
}

export function useNow(): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => subscribe(setNow), [])
  return now
}

export const formatTime = (d: Date) => d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
