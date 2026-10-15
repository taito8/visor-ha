/** Preferencias de una cámara elegidas por el usuario. El orden del arreglo es el orden en la grilla. */
export interface CameraPref {
  entityId: string
  /** Nombre a mostrar. Vacío o ausente = el nombre que tiene en Home Assistant. */
  name?: string
  enabled: boolean
}

/** Configuración que el proceso main comparte con la interfaz (nunca incluye el token). */
export interface AppConfig {
  haUrl: string | null
  hasToken: boolean
  /** null = el usuario todavía no eligió cámaras (se muestran todas). */
  cameras: CameraPref[] | null
}

/** API expuesta por el preload en `window.visor`. */
export interface VisorApi {
  getConfig(): Promise<AppConfig>
  getToken(): Promise<string | null>
  saveConnection(haUrl: string, token: string): Promise<void>
  saveCameras(cameras: CameraPref[]): Promise<void>
  /** Se dispara cuando el usuario elige "Configuración…" en el menú. Devuelve la función para desuscribirse. */
  onOpenSetup(cb: () => void): () => void
}
