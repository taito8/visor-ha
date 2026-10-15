import { app, safeStorage } from 'electron'
import { existsSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { CameraPref, ViewPrefs } from '../shared/types'

/** Lo que se guarda en config.json (todo menos el token). */
export interface StoredConfig {
  haUrl: string | null
  cameras: CameraPref[] | null
  view: ViewPrefs
  window?: WindowState
}

/** Tamaño y posición de la ventana (en modo normal, no maximizada). */
export interface WindowState {
  x: number
  y: number
  width: number
  height: number
  maximized: boolean
}

const DEFAULT_VIEW: ViewPrefs = { layout: 'auto', alwaysOnTop: false, startFullscreen: false }
const DEFAULTS: StoredConfig = { haUrl: null, cameras: null, view: DEFAULT_VIEW }

const configPath = () => join(app.getPath('userData'), 'config.json')
const tokenPath = () => join(app.getPath('userData'), 'token.enc')

function writeAtomic(path: string, data: string | Buffer): void {
  const tmp = `${path}.tmp`
  writeFileSync(tmp, data)
  renameSync(tmp, path)
}

export function loadConfig(): StoredConfig {
  try {
    if (!existsSync(configPath())) return { ...DEFAULTS }
    const stored = JSON.parse(readFileSync(configPath(), 'utf8'))
    return { ...DEFAULTS, ...stored, view: { ...DEFAULT_VIEW, ...stored.view } }
  } catch (err) {
    console.error('No se pudo leer config.json, se usan valores por defecto', err)
    return { ...DEFAULTS }
  }
}

export function saveConfig(config: StoredConfig): void {
  writeAtomic(configPath(), JSON.stringify(config, null, 2))
}

export function hasToken(): boolean {
  return existsSync(tokenPath())
}

export function loadToken(): string | null {
  if (!existsSync(tokenPath())) return null
  try {
    return safeStorage.decryptString(readFileSync(tokenPath()))
  } catch (err) {
    // Pasa si cambió el usuario del sistema o el llavero: hay que volver a ingresar el token.
    console.error('No se pudo descifrar el token guardado', err)
    rmSync(tokenPath(), { force: true })
    return null
  }
}

export function saveToken(token: string): void {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('El sistema no permite guardar el token de forma cifrada.')
  }
  writeAtomic(tokenPath(), safeStorage.encryptString(token))
}
