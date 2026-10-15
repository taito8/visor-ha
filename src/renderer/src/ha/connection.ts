import {
  createConnection,
  createLongLivedTokenAuth,
  ERR_CANNOT_CONNECT,
  ERR_INVALID_AUTH,
  type Connection
} from 'home-assistant-js-websocket'

export type HaErrorKind = 'url' | 'auth' | 'unreachable' | 'timeout'

export class HaError extends Error {
  constructor(public kind: HaErrorKind, message: string) {
    super(message)
  }
}

/**
 * Acepta lo que escriba el usuario ("192.168.1.10:8123", "https://casa.ts.net/lovelace/0")
 * y devuelve solo el origen ("http://192.168.1.10:8123").
 */
export function normalizeUrl(input: string): string {
  let text = input.trim()
  if (!text) throw new HaError('url', 'Escribí la dirección de tu Home Assistant.')
  if (!/^[a-z]+:\/\//i.test(text)) text = `http://${text}`
  let url: URL
  try {
    url = new URL(text)
  } catch {
    throw new HaError('url', 'La dirección no es válida. Ejemplo: http://192.168.1.50:8123')
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new HaError('url', 'La dirección tiene que empezar con http:// o https://')
  }
  return url.origin
}

/**
 * true si la dirección es http:// y apunta fuera de la red local. En ese caso el token viaja
 * sin cifrar por internet. Las direcciones de Tailscale (100.64.0.0/10 y *.ts.net) ya van
 * cifradas por el túnel, así que no cuentan.
 */
export function isInsecureRemote(origin: string): boolean {
  const url = new URL(origin)
  if (url.protocol !== 'http:') return false
  const host = url.hostname
  // Un nombre sin puntos (por ejemplo "homeassistant") solo se resuelve dentro de la red local.
  if (!host.includes('.') || host === 'localhost' || host.endsWith('.local') || host.endsWith('.ts.net') || host.endsWith('.home.arpa')) return false
  const ip = host.match(/^(\d+)\.(\d+)\.\d+\.\d+$/)
  if (!ip) return true
  const [a, b] = [Number(ip[1]), Number(ip[2])]
  return !(a === 10 || a === 127 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31) || (a === 100 && b >= 64 && b <= 127))
}

/** Conecta al websocket de HA. Lanza HaError con un mensaje en español si algo falla. */
export async function connectHA(haUrl: string, token: string, timeoutMs = 10_000): Promise<Connection> {
  const auth = createLongLivedTokenAuth(haUrl, token.trim())
  const attempt = createConnection({ auth })

  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      // Si la conexión llega a establecerse tarde, la cerramos para no dejarla colgada.
      attempt.then((conn) => conn.close()).catch(() => {})
      reject(new HaError('timeout', `Home Assistant no respondió en ${haUrl}. Revisá la dirección y que esta computadora pueda llegar a esa red.`))
    }, timeoutMs)
  })

  try {
    return await Promise.race([attempt, timeout])
  } catch (err) {
    if (err instanceof HaError) throw err
    if (err === ERR_INVALID_AUTH) {
      throw new HaError('auth', 'Home Assistant rechazó el token. Revisá que lo hayas copiado completo y que no lo hayas borrado en HA.')
    }
    if (err === ERR_CANNOT_CONNECT) {
      throw new HaError('unreachable', `No se pudo conectar con ${haUrl}. Revisá la dirección (incluido el puerto, normalmente :8123) y que esta computadora esté en la misma red o en Tailscale.`)
    }
    throw new HaError('unreachable', `Error inesperado al conectar (${String(err)}).`)
  } finally {
    clearTimeout(timer)
  }
}
