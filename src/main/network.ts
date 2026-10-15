import { session } from 'electron'

/**
 * Hace que la interfaz pueda hablar con Home Assistant sin tocar su configuración:
 *  - agrega el header Authorization a los pedidos HTTP hacia HA (MJPEG, etc.), así el token
 *    nunca queda escrito en una URL;
 *  - agrega los headers CORS a las respuestas de HA y contesta los preflight (OPTIONS).
 * Solo afecta pedidos cuyo origen coincide exactamente con la URL de HA configurada.
 */
let haOrigin: string | null = null
let haToken: string | null = null

export function setHaAuth(url: string | null, token: string | null): void {
  haOrigin = url ? new URL(url).origin : null
  haToken = token
}

function isHaRequest(url: string): boolean {
  if (!haOrigin) return false
  try {
    return new URL(url).origin === haOrigin
  } catch {
    return false
  }
}

export function installNetworkHooks(): void {
  const { webRequest } = session.defaultSession

  webRequest.onBeforeSendHeaders((details, callback) => {
    const headers = details.requestHeaders
    if (haToken && isHaRequest(details.url) && !Object.keys(headers).some((k) => k.toLowerCase() === 'authorization')) {
      headers['Authorization'] = `Bearer ${haToken}`
    }
    callback({ requestHeaders: headers })
  })

  webRequest.onHeadersReceived((details, callback) => {
    if (!isHaRequest(details.url)) {
      callback({})
      return
    }
    const headers = { ...details.responseHeaders }
    for (const key of Object.keys(headers)) {
      if (key.toLowerCase().startsWith('access-control-')) delete headers[key]
    }
    headers['Access-Control-Allow-Origin'] = ['*']
    headers['Access-Control-Allow-Headers'] = ['Authorization, Content-Type, Range']
    headers['Access-Control-Allow-Methods'] = ['GET, POST, OPTIONS']
    headers['Access-Control-Expose-Headers'] = ['Content-Length, Content-Range']
    if (details.method === 'OPTIONS') {
      callback({ responseHeaders: headers, statusLine: 'HTTP/1.1 204 No Content' })
    } else {
      callback({ responseHeaders: headers })
    }
  })
}
