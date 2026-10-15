import { subscribeEntities, type Connection } from 'home-assistant-js-websocket'
import { useEffect, useState } from 'preact/hooks'
import { camerasFromEntities, sameCameras, type CameraInfo } from './cameras'
import { connectHA, HaError } from './connection'

export interface Credentials {
  haUrl: string
  token: string
}

export type ConnState =
  | { kind: 'idle' }
  | { kind: 'connecting' }
  | { kind: 'ready' }
  | { kind: 'lost' }
  | { kind: 'error'; message: string; retrying: boolean }

export interface HaSession {
  conn: Connection | null
  state: ConnState
  /** Cambia cada vez que el websocket se reconecta, para reiniciar los streams. */
  generation: number
  /** null hasta recibir la primera lista de entidades. */
  cameras: CameraInfo[] | null
}

/** Mantiene la conexión con HA y la lista de cámaras mientras haya credenciales. */
export function useHaConnection(creds: Credentials | null): HaSession {
  const [conn, setConn] = useState<Connection | null>(null)
  const [state, setState] = useState<ConnState>({ kind: 'idle' })
  const [generation, setGeneration] = useState(0)
  const [cameras, setCameras] = useState<CameraInfo[] | null>(null)

  useEffect(() => {
    setConn(null)
    setCameras(null)
    if (!creds) {
      setState({ kind: 'idle' })
      return
    }

    let disposed = false
    let current: Connection | null = null
    let unsubscribe: (() => void) | undefined
    let retryTimer: ReturnType<typeof setTimeout> | undefined

    const run = async () => {
      setState({ kind: 'connecting' })
      try {
        current = await connectHA(creds.haUrl, creds.token)
      } catch (err) {
        if (disposed) return
        const message = err instanceof Error ? err.message : String(err)
        const retrying = !(err instanceof HaError && err.kind === 'auth')
        setState({ kind: 'error', message, retrying })
        if (retrying) retryTimer = setTimeout(run, 5_000)
        return
      }
      if (disposed) {
        current.close()
        return
      }
      // La librería reconecta sola; al volver, se reinician todos los streams.
      current.addEventListener('disconnected', () => setState({ kind: 'lost' }))
      current.addEventListener('ready', () => {
        setState({ kind: 'ready' })
        setGeneration((g) => g + 1)
      })
      current.addEventListener('reconnect-error', () =>
        setState({ kind: 'error', message: 'Home Assistant rechazó el token al reconectar. Revisá la configuración.', retrying: false })
      )
      unsubscribe = subscribeEntities(current, (entities) => {
        const next = camerasFromEntities(entities)
        setCameras((prev) => (prev && sameCameras(prev, next) ? prev : next))
      })
      setConn(current)
      setState({ kind: 'ready' })
    }
    void run()

    return () => {
      disposed = true
      clearTimeout(retryTimer)
      unsubscribe?.()
      current?.close()
    }
  }, [creds?.haUrl, creds?.token])

  return { conn, state, generation, cameras }
}
