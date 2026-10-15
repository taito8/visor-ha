import { screen, type BrowserWindow, type Rectangle } from 'electron'
import { loadConfig, saveConfig, type WindowState } from './config'

const DEFAULT_SIZE = { width: 1280, height: 800 }

/** Devuelve la posición guardada solo si todavía cae dentro de alguna pantalla (por si se desconectó un monitor). */
export function restoredBounds(): Partial<Rectangle> & { maximized: boolean } {
  const saved = loadConfig().window
  if (!saved) return { ...DEFAULT_SIZE, maximized: false }
  const visible = screen.getAllDisplays().some(({ workArea: a }) => {
    const overlapW = Math.min(saved.x + saved.width, a.x + a.width) - Math.max(saved.x, a.x)
    const overlapH = Math.min(saved.y + saved.height, a.y + a.height) - Math.max(saved.y, a.y)
    return overlapW >= 100 && overlapH >= 100
  })
  if (!visible) return { width: saved.width, height: saved.height, maximized: saved.maximized }
  return { x: saved.x, y: saved.y, width: saved.width, height: saved.height, maximized: saved.maximized }
}

/** Guarda tamaño y posición cuando la ventana se mueve, cambia de tamaño o se cierra. */
export function trackWindowState(win: BrowserWindow): void {
  let timer: ReturnType<typeof setTimeout> | undefined
  const save = () => {
    clearTimeout(timer)
    if (win.isDestroyed() || win.isFullScreen() || win.isMinimized()) return
    const { x, y, width, height } = win.getNormalBounds()
    const state: WindowState = { x, y, width, height, maximized: win.isMaximized() }
    saveConfig({ ...loadConfig(), window: state })
  }
  const saveSoon = () => {
    clearTimeout(timer)
    timer = setTimeout(save, 500)
  }
  win.on('resize', saveSoon)
  win.on('move', saveSoon)
  win.on('maximize', saveSoon)
  win.on('unmaximize', saveSoon)
  win.on('close', save)
}
