import type { HassEntities, HassEntity } from 'home-assistant-js-websocket'
import type { CameraPref } from '@shared/types'

/** Bit de `supported_features` que indica que la cámara puede dar un stream (HLS/WebRTC). */
export const CAMERA_SUPPORT_STREAM = 2

export interface CameraInfo {
  entityId: string
  name: string
  available: boolean
  supportedFeatures: number
  /** Atributo viejo de HA ("hls" o "web_rtc"). En versiones nuevas puede no estar. */
  frontendStreamType: string | null
}

function toCamera(entity: HassEntity): CameraInfo {
  const attrs = entity.attributes
  return {
    entityId: entity.entity_id,
    name: typeof attrs.friendly_name === 'string' ? attrs.friendly_name : entity.entity_id,
    available: entity.state !== 'unavailable' && entity.state !== 'unknown',
    supportedFeatures: typeof attrs.supported_features === 'number' ? attrs.supported_features : 0,
    frontendStreamType: typeof attrs.frontend_stream_type === 'string' ? attrs.frontend_stream_type : null
  }
}

export function camerasFromEntities(entities: HassEntities): CameraInfo[] {
  return Object.values(entities)
    .filter((e) => e.entity_id.startsWith('camera.'))
    .map(toCamera)
    .sort((a, b) => a.entityId.localeCompare(b.entityId))
}

/** Compara solo lo que afecta a cómo se muestra la cámara, para no reiniciar streams por cambios irrelevantes. */
export function sameCameras(a: CameraInfo[], b: CameraInfo[]): boolean {
  return a.length === b.length && a.every((cam, i) => JSON.stringify(cam) === JSON.stringify(b[i]))
}

export interface CameraEntry {
  cam: CameraInfo
  pref: CameraPref
  /** Nombre a mostrar: el elegido por el usuario o el de HA. */
  displayName: string
}

/**
 * Combina las cámaras de HA con las preferencias guardadas, en el orden elegido.
 * Las cámaras nuevas (que no estaban en las preferencias) se agregan al final, visibles.
 */
export function mergeCameraPrefs(cameras: CameraInfo[], prefs: CameraPref[] | null): CameraEntry[] {
  const byId = new Map(cameras.map((c) => [c.entityId, c]))
  const entries: CameraEntry[] = []
  for (const pref of prefs ?? []) {
    const cam = byId.get(pref.entityId)
    if (!cam) continue
    byId.delete(pref.entityId)
    entries.push({ cam, pref, displayName: pref.name?.trim() || cam.name })
  }
  for (const cam of byId.values()) {
    entries.push({ cam, pref: { entityId: cam.entityId, enabled: true }, displayName: cam.name })
  }
  return entries
}

/**
 * Preferencias a guardar a partir de la lista editada. Conserva al final las de cámaras
 * que hoy no aparecen en HA (por si están caídas temporalmente).
 */
export function prefsFromEntries(entries: CameraEntry[], previous: CameraPref[] | null): CameraPref[] {
  const listed = new Set(entries.map((e) => e.cam.entityId))
  return [...entries.map((e) => e.pref), ...(previous ?? []).filter((p) => !listed.has(p.entityId))]
}
