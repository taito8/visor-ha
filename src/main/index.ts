import { app, BrowserWindow, ipcMain, Menu, shell, type MenuItemConstructorOptions } from 'electron'
import { join } from 'node:path'
import type { AppConfig, CameraPref } from '../shared/types'
import { hasToken, loadConfig, loadToken, saveConfig, saveToken } from './config'
import { installNetworkHooks, setHaAuth } from './network'

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 480,
    minHeight: 320,
    title: 'Visor HA',
    backgroundColor: '#0b0b0d',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  mainWindow.once('ready-to-show', () => mainWindow?.show())

  // Los links (por ejemplo, "abrir mi perfil en HA") se abren en el navegador del sistema.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })
  mainWindow.webContents.on('will-navigate', (event) => event.preventDefault())

  if (process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow.on('closed', () => (mainWindow = null))
}

function buildMenu(): void {
  const isMac = process.platform === 'darwin'
  const openSetup: MenuItemConstructorOptions = {
    label: 'Configuración…',
    accelerator: 'CmdOrCtrl+,',
    click: () => mainWindow?.webContents.send('nav:setup')
  }
  const template: MenuItemConstructorOptions[] = [
    ...(isMac
      ? [{
          label: app.name,
          submenu: [
            { role: 'about', label: 'Acerca de Visor HA' },
            { type: 'separator' },
            openSetup,
            { type: 'separator' },
            { role: 'hide', label: 'Ocultar Visor HA' },
            { role: 'hideOthers', label: 'Ocultar otros' },
            { role: 'unhide', label: 'Mostrar todo' },
            { type: 'separator' },
            { role: 'quit', label: 'Salir de Visor HA' }
          ]
        } satisfies MenuItemConstructorOptions]
      : [{ label: 'Archivo', submenu: [openSetup, { type: 'separator' }, { role: 'quit', label: 'Salir' }] } satisfies MenuItemConstructorOptions]),
    {
      label: 'Edición',
      submenu: [
        { role: 'undo', label: 'Deshacer' },
        { role: 'redo', label: 'Rehacer' },
        { type: 'separator' },
        { role: 'cut', label: 'Cortar' },
        { role: 'copy', label: 'Copiar' },
        { role: 'paste', label: 'Pegar' },
        { role: 'selectAll', label: 'Seleccionar todo' }
      ]
    },
    {
      label: 'Ver',
      submenu: [
        { role: 'reload', label: 'Recargar' },
        { role: 'toggleDevTools', label: 'Herramientas de desarrollo' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Pantalla completa' }
      ]
    }
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

function registerIpc(): void {
  ipcMain.handle('config:get', (): AppConfig => {
    const { haUrl, cameras } = loadConfig()
    return { haUrl, cameras, hasToken: hasToken() }
  })
  ipcMain.handle('config:getToken', () => loadToken())
  ipcMain.handle('config:saveConnection', (_event, haUrl: unknown, token: unknown) => {
    if (typeof haUrl !== 'string' || typeof token !== 'string' || !token.trim()) {
      throw new Error('Datos de conexión inválidos')
    }
    const url = new URL(haUrl)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('La URL debe empezar con http:// o https://')
    saveToken(token.trim())
    const previous = loadConfig()
    // Si cambia el servidor, la selección de cámaras del anterior ya no sirve.
    saveConfig({ ...previous, haUrl: url.origin, cameras: previous.haUrl === url.origin ? previous.cameras : null })
    setHaAuth(url.origin, token.trim())
  })
  ipcMain.handle('config:saveCameras', (_event, cameras: unknown) => {
    if (!Array.isArray(cameras)) throw new Error('Lista de cámaras inválida')
    const clean: CameraPref[] = cameras
      .filter((c): c is CameraPref => !!c && typeof c.entityId === 'string' && typeof c.enabled === 'boolean')
      .map((c) => ({
        entityId: c.entityId,
        enabled: c.enabled,
        ...(typeof c.name === 'string' && c.name.trim() ? { name: c.name.trim() } : {})
      }))
    saveConfig({ ...loadConfig(), cameras: clean })
  })
}

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  })

  app.whenReady().then(() => {
    const config = loadConfig()
    setHaAuth(config.haUrl, config.haUrl ? loadToken() : null)
    installNetworkHooks()
    registerIpc()
    buildMenu()
    createWindow()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  app.on('window-all-closed', () => app.quit())
}
