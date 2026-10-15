import type { Connection } from 'home-assistant-js-websocket'

export type StreamMethod = 'webrtc' | 'hls' | 'mjpeg'

export const METHOD_LABEL: Record<StreamMethod, string> = {
  webrtc: 'WebRTC',
  hls: 'HLS',
  mjpeg: 'MJPEG'
}

export interface StreamContext {
  conn: Connection
  haUrl: string
  entityId: string
}

export interface PlayerCallbacks {
  /** Llega la primera imagen. */
  onPlaying(): void
  /** El stream no arrancó o se cortó. Se llama una sola vez por reproductor. */
  onError(reason: string): void
}

export interface StreamPlayer {
  destroy(): void
}

/** Crea el reproductor y lo agrega dentro de `container`. Nunca llama a los callbacks de forma sincrónica. */
export type PlayerFactory = (container: HTMLElement, ctx: StreamContext, cb: PlayerCallbacks) => StreamPlayer

/** Envuelve onError para que solo se dispare una vez. */
export function once(fn: (reason: string) => void): (reason: string) => void {
  let called = false
  return (reason) => {
    if (called) return
    called = true
    fn(reason)
  }
}

/** Traduce los errores técnicos más comunes a un texto corto en español para mostrar en el tile. */
export function describeError(err: unknown): string {
  // home-assistant-js-websocket rechaza con el número 3 (ERR_CONNECTION_LOST) si se corta el websocket.
  if (err === 3) return 'sin conexión con Home Assistant'
  const message = err && typeof err === 'object' && 'message' in err && typeof err.message === 'string' ? err.message : String(err)
  if (/failed to fetch|network ?error|networkerror/i.test(message)) return 'sin conexión con Home Assistant'
  return message
}

/**
 * Vigila un <video>: avisa cuando empieza a reproducir y da error si la imagen
 * queda congelada (el tiempo de reproducción no avanza). Devuelve la función para dejar de vigilar.
 */
export function watchVideo(video: HTMLVideoElement, onPlaying: () => void, onError: (reason: string) => void): () => void {
  let playing = false
  let lastTime = -1
  let lastProgress = Date.now()
  const handlePlaying = () => {
    if (!playing) {
      playing = true
      onPlaying()
    }
  }
  video.addEventListener('playing', handlePlaying)
  const timer = setInterval(() => {
    if (video.currentTime !== lastTime) {
      lastTime = video.currentTime
      lastProgress = Date.now()
    } else if (Date.now() - lastProgress > (playing ? 20_000 : 30_000)) {
      onError(playing ? 'la imagen se congeló' : 'el video no arrancó')
    }
  }, 2_000)
  return () => {
    clearInterval(timer)
    video.removeEventListener('playing', handlePlaying)
  }
}
