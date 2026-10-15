import { describeError, once, type PlayerFactory } from './types'

const MAX_BUFFER = 8 * 1024 * 1024

function concat(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length + b.length)
  out.set(a)
  out.set(b, a.length)
  return out
}

/** Busca el par de bytes 0xFF `second` a partir de `from`. */
function findMarker(buf: Uint8Array, second: number, from: number): number {
  for (let i = from; i < buf.length - 1; i++) {
    if (buf[i] === 0xff && buf[i + 1] === second) return i
  }
  return -1
}

/**
 * MJPEG vía /api/camera_proxy_stream. Se lee con fetch (el token lo agrega el proceso main)
 * y se recortan los JPEG por sus marcadores de inicio/fin. Así podemos detectar si el
 * stream se congela y reconectar, cosa que un <img> no permite.
 */
export const startMjpeg: PlayerFactory = (container, ctx, cb) => {
  const abort = new AbortController()
  const fail = once(cb.onError)
  const canvas = document.createElement('canvas')
  const g = canvas.getContext('2d')!
  container.append(canvas)

  let playing = false
  let decoding = false
  let lastFrame = Date.now()
  const watchdog = setInterval(() => {
    if (Date.now() - lastFrame > (playing ? 20_000 : 30_000)) fail(playing ? 'la imagen se congeló' : 'no llegan imágenes')
  }, 2_000)

  const draw = async (jpeg: Uint8Array) => {
    try {
      const bitmap = await createImageBitmap(new Blob([jpeg as BlobPart], { type: 'image/jpeg' }))
      if (abort.signal.aborted) return bitmap.close()
      if (canvas.width !== bitmap.width || canvas.height !== bitmap.height) {
        canvas.width = bitmap.width
        canvas.height = bitmap.height
      }
      g.drawImage(bitmap, 0, 0)
      bitmap.close()
      if (!playing) {
        playing = true
        cb.onPlaying()
      }
    } catch {
      // Cuadro dañado: se descarta y se espera el siguiente.
    }
  }

  void (async () => {
    const url = `${ctx.haUrl}/api/camera_proxy_stream/${encodeURIComponent(ctx.entityId)}`
    const res = await fetch(url, { signal: abort.signal, cache: 'no-store' })
    if (res.status === 401 || res.status === 403) throw new Error('HA rechazó el pedido (token)')
    if (!res.ok || !res.body) throw new Error(`HA respondió ${res.status}`)
    const reader = res.body.getReader()
    let buf: Uint8Array = new Uint8Array(0)
    for (;;) {
      const { value, done } = await reader.read()
      if (done) throw new Error('el stream terminó')
      buf = concat(buf, value)
      for (;;) {
        const start = findMarker(buf, 0xd8, 0)
        if (start < 0) {
          buf = buf.slice(-1)
          break
        }
        const end = findMarker(buf, 0xd9, start + 2)
        if (end < 0) {
          buf = buf.slice(start)
          break
        }
        const frame = buf.slice(start, end + 2)
        buf = buf.slice(end + 2)
        lastFrame = Date.now()
        // Si todavía se está dibujando el cuadro anterior, este se saltea (evita acumular atraso).
        if (!decoding) {
          decoding = true
          void draw(frame).finally(() => (decoding = false))
        }
      }
      if (buf.length > MAX_BUFFER) buf = new Uint8Array(0)
    }
  })().catch((err) => {
    if (!abort.signal.aborted) fail(describeError(err))
  })

  return {
    destroy() {
      abort.abort()
      clearInterval(watchdog)
      canvas.remove()
    }
  }
}
