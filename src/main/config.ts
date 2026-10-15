import { app, safeStorage } from 'electron'
import { existsSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { CameraPref } from '../shared/types'

/** Lo que se guarda en config.json (todo menos el token). */
export interface StoredConfig {
  haUrl: string | null
  cameras: CameraPref[] | null
}

const DEFAULTS: StoredConfig = { haUrl: null, cameras: null }

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
    return { ...DEFAULTS, ...JSON.parse(readFileSync(configPath(), 'utf8')) }
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
