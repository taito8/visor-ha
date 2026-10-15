import type { Connection } from 'home-assistant-js-websocket'
import { useEffect, useRef, useState } from 'preact/hooks'
import { formatTime, useNow } from '../clock'
import type { CameraInfo } from '../ha/cameras'
import { clearMethodHint, getMethodHint, setMethodHint } from '../streams/hints'
import { PLAYERS, streamMethods } from '../streams/selector'
import { METHOD_LABEL, type StreamMethod, type StreamPlayer } from '../streams/types'

type Status = 'connecting' | 'playing' | 'reconnecting' | 'unavailable'

const STATUS_TEXT: Record<Exclude<Status, 'playing'>, string> = {
  connecting: 'Conectando…',
  reconnecting: 'Reconectando…',
  unavailable: 'Cámara no disponible'
}

/** Fallas seguidas con un mismo método antes de pasar al siguiente. */
const FAILURES_BEFORE_FALLBACK = 2

interface Props {
  cam: CameraInfo
  /** Nombre a mostrar (puede ser el elegido por el usuario). */
  name: string
  conn: Connection
  haUrl: string
  /** Ampliada a toda la ventana. Las demás siguen reproduciendo detrás, para volver al instante. */
  focused: boolean
  onDoubleClick(): void
}

export function Tile({ cam, name, conn, haUrl, focused, onDoubleClick }: Props) {
  const mediaRef = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState<Status>('connecting')
  const [method, setMethod] = useState<StreamMethod | null>(null)
  const [detail, setDetail] = useState('')
  const now = useNow()

  useEffect(() => {
    if (!cam.available) {
      setStatus('unavailable')
      setMethod(null)
      return
    }
    setStatus('connecting')
    setDetail('')

    let disposed = false
    let player: StreamPlayer | null = null
    let retryTimer: ReturnType<typeof setTimeout> | undefined
    let methods: StreamMethod[] = []
    let index = 0
    let failuresOnMethod = 0
    let attempt = 0
    /** true si se llegó al método actual porque los anteriores fallaron en esta sesión. */
    let reachedByFallback = false

    const start = () => {
      if (disposed || !mediaRef.current) return
      const current = methods[index]
      setMethod(current)
      player = PLAYERS[current](mediaRef.current, { conn, haUrl, entityId: cam.entityId }, {
        onPlaying: () => {
          if (disposed) return
          setStatus('playing')
          setDetail('')
          failuresOnMethod = 0
          attempt = 0
          if (index === 0) clearMethodHint(cam.entityId)
          else if (reachedByFallback) setMethodHint(cam.entityId, current, methods[0])
        },
        onError: (reason) => {
          if (disposed) return
          console.warn(`[${cam.entityId}] ${METHOD_LABEL[current]} falló: ${reason}`)
          player?.destroy()
          player = null
          attempt++
          if (++failuresOnMethod >= FAILURES_BEFORE_FALLBACK) {
            failuresOnMethod = 0
            index = (index + 1) % methods.length
            reachedByFallback = index > 0
          }
          setStatus('reconnecting')
          setDetail(reason)
          const delay = Math.min(30, 2 ** Math.min(attempt - 1, 5)) * 1000
          retryTimer = setTimeout(start, delay)
        }
      })
    }

    void streamMethods(conn, cam).then((list) => {
      if (disposed) return
      methods = list
      // Si la última vez hubo que bajar de método, se arranca directo con el que funcionó.
      const hint = getMethodHint(cam.entityId, list[0])
      if (hint && list.includes(hint)) index = list.indexOf(hint)
      start()
    })

    return () => {
      disposed = true
      clearTimeout(retryTimer)
      player?.destroy()
    }
  }, [cam.entityId, cam.available, cam.supportedFeatures, cam.frontendStreamType, conn, haUrl])

  return (
    <div
      class={focused ? 'tile focused' : 'tile'}
      title={focused ? 'Doble clic o Esc para volver a la grilla' : 'Doble clic para ampliar'}
      onDblClick={onDoubleClick}
    >
      <div class="media" ref={mediaRef} />
      <div class="overlay top-left">
        <span class="name">{name}</span>
        <span class="time">{formatTime(now)}</span>
      </div>
      {method && status !== 'unavailable' && <div class="overlay top-right badge">{METHOD_LABEL[method]}</div>}
      {status !== 'playing' && (
        <div class="status">
          <span>{STATUS_TEXT[status]}</span>
          {detail && <small>{detail}</small>}
        </div>
      )}
    </div>
  )
}
