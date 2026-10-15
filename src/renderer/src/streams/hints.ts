import type { StreamMethod } from './types'

/**
 * Recuerda, por cámara, a qué método hubo que bajar porque el preferido no anduvo
 * (por ejemplo, HLS → MJPEG). Así, al abrir la app, esa cámara arranca directo con el
 * método que funciona en vez de esperar a que el otro falle. El recuerdo vence a las
 * 6 horas para volver a probar el método preferido de vez en cuando, y deja de valer si
 * cambia el método preferido de la cámara (por ejemplo, si HA empieza a ofrecer WebRTC).
 */
const KEY = 'visor.methodHints'
const TTL_MS = 6 * 60 * 60 * 1000

type Hints = Record<string, { method: StreamMethod; preferred?: StreamMethod; at: number }>

function read(): Hints {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Hints
  } catch {
    return {}
  }
}

function write(hints: Hints): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(hints))
  } catch {
    // Sin almacenamiento: simplemente no se recuerda.
  }
}

/** `preferred` es el primer método de la lista actual de la cámara. */
export function getMethodHint(entityId: string, preferred: StreamMethod): StreamMethod | null {
  const hint = read()[entityId]
  return hint && hint.preferred === preferred && Date.now() - hint.at < TTL_MS ? hint.method : null
}

export function setMethodHint(entityId: string, method: StreamMethod, preferred: StreamMethod): void {
  write({ ...read(), [entityId]: { method, preferred, at: Date.now() } })
}

export function clearMethodHint(entityId: string): void {
  const hints = read()
  if (!(entityId in hints)) return
  delete hints[entityId]
  write(hints)
}
