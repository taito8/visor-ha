/** Preferencias de una cámara elegidas por el usuario. El orden del arreglo es el orden en la grilla. */
export interface CameraPref {
  entityId: string
  /** Nombre a mostrar. Vacío o ausente = el nombre que tiene en Home Assistant. */
  name?: string
  enabled: boolean
}

/** Diseño de la grilla. 'auto' acomoda según la cantidad de cámaras; el resto muestra páginas fijas. */
export type GridLayout = 'auto' | 'single' | '2x2' | '3x3' | '1+5'

export const GRID_LAYOUTS: { id: GridLayout; label: string }[] = [
  { id: 'auto', label: 'Automático' },
  { id: 'single', label: '1 cámara' },
  { id: '2x2', label: '2 × 2' },
  { id: '3x3', label: '3 × 3' },
  { id: '1+5', label: '1 grande + 5 chicas' }
]

/** Preferencias de pantalla. Las maneja el proceso main (también se cambian desde el menú). */
export interface ViewPrefs {
  layout: GridLayout
  alwaysOnTop: boolean
  startFullscreen: boolean
}

/** Configuración que el proceso main comparte con la interfaz (nunca incluye el token). */
export interface AppConfig {
  haUrl: string | null
  hasToken: boolean
  /** null = el usuario todavía no eligió cámaras (se muestran todas). */
  cameras: CameraPref[] | null
  view: ViewPrefs
}

/** API expuesta por el preload en `window.visor`. */
export interface VisorApi {
  getConfig(): Promise<AppConfig>
  getToken(): Promise<string | null>
  saveConnection(haUrl: string, token: string): Promise<void>
  saveCameras(cameras: CameraPref[]): Promise<void>
  setViewPrefs(patch: Partial<ViewPrefs>): Promise<void>
  /** Avisa cuando cambian las preferencias de pantalla (por ejemplo, desde el menú). */
  onViewPrefs(cb: (prefs: ViewPrefs) => void): () => void
  /** Sale de pantalla completa si la ventana está en ese modo. */
  exitFullscreen(): void
  /** Se dispara cuando el usuario elige "Configuración…" en el menú. Devuelve la función para desuscribirse. */
  onOpenSetup(cb: () => void): () => void
}
