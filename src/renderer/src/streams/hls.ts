import Hls from 'hls.js'
import { describeError, once, watchVideo, type PlayerFactory } from './types'

const MANIFEST_TIMEOUT_MS = 15_000

/** HLS: se pide a HA una URL firmada con `camera/stream` y se reproduce con hls.js. */
export const startHls: PlayerFactory = (container, ctx, cb) => {
  let destroyed = false
  let hls: Hls | null = null
  const fail = once(cb.onError)

  const video = document.createElement('video')
  video.muted = true
  video.autoplay = true
  video.playsInline = true
  container.append(video)
  /** Códecs del stream, conocidos cuando HA entrega la lista de reproducción. Sirven para explicar fallas. */
  let codecs: string | null = null
  const stopWatch = watchVideo(video, cb.onPlaying, (reason) =>
    fail(codecs === null ? `${reason}: HA no entregó el video` : `${reason} (códec ${codecs || 'desconocido'})`)
  )
  // Si HA no entrega la lista de reproducción a tiempo, no tiene sentido seguir esperando:
  // en cámaras que funcionan llega en pocos segundos.
  const manifestTimer = setTimeout(() => {
    if (codecs === null) fail('HA no entregó el video')
  }, MANIFEST_TIMEOUT_MS)

  void (async () => {
    try {
      const res = await ctx.conn.sendMessagePromise<{ url: string }>({ type: 'camera/stream', entity_id: ctx.entityId })
      if (destroyed) return
      if (!Hls.isSupported()) throw new Error('HLS no es compatible en este equipo')

      hls = new Hls({ lowLatencyMode: true, liveDurationInfinity: true, backBufferLength: 10 })
      let recoveredMedia = false
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (!data.fatal) {
          console.info(`[${ctx.entityId}] HLS aviso: ${data.details}`)
          return
        }
        if (data.type === Hls.ErrorTypes.MEDIA_ERROR && !recoveredMedia) {
          recoveredMedia = true
          hls?.recoverMediaError()
          return
        }
        fail(`HLS: ${data.details}`)
      })
      hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
        codecs = data.levels.map((l) => [l.videoCodec, l.audioCodec].filter(Boolean).join('+')).join(', ')
        console.info(`[${ctx.entityId}] HLS códecs: ${codecs || 'desconocidos'}`)
        video.play().catch(() => {})
      })
      hls.loadSource(new URL(res.url, ctx.haUrl).toString())
      hls.attachMedia(video)
    } catch (err) {
      if (!destroyed) fail(describeError(err))
    }
  })()

  return {
    destroy() {
      destroyed = true
      clearTimeout(manifestTimer)
      stopWatch()
      hls?.destroy()
      video.removeAttribute('src')
      video.load()
      video.remove()
    }
  }
}
