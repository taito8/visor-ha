import type { Connection } from 'home-assistant-js-websocket'
import { CAMERA_SUPPORT_STREAM, type CameraInfo } from '../ha/cameras'
import { startHls } from './hls'
import { startMjpeg } from './mjpeg'
import type { PlayerFactory, StreamMethod } from './types'
import { startWebRtc } from './webrtc'

export const PLAYERS: Record<StreamMethod, PlayerFactory> = {
  webrtc: startWebRtc,
  hls: startHls,
  mjpeg: startMjpeg
}

/**
 * Qué tipos de stream ofrece HA para esta cámara. Las versiones nuevas responden
 * `camera/capabilities`; si no existe, se deduce de los atributos de la entidad.
 */
async function frontendStreamTypes(conn: Connection, cam: CameraInfo): Promise<string[]> {
  try {
    const res = await conn.sendMessagePromise<{ frontend_stream_types: string[] }>({
      type: 'camera/capabilities',
      entity_id: cam.entityId
    })
    return res.frontend_stream_types ?? []
  } catch {
    if (!(cam.supportedFeatures & CAMERA_SUPPORT_STREAM)) return []
    return [cam.frontendStreamType ?? 'hls']
  }
}

/** Métodos a probar, en orden de preferencia. MJPEG siempre queda como último recurso. */
export async function streamMethods(conn: Connection, cam: CameraInfo): Promise<StreamMethod[]> {
  const types = await frontendStreamTypes(conn, cam)
  const methods: StreamMethod[] = []
  if (types.includes('web_rtc')) methods.push('webrtc')
  if (types.includes('hls')) methods.push('hls')
  methods.push('mjpeg')
  return methods
}
