import { app, BrowserWindow, ipcMain, Menu, session, shell, type IpcMainEvent, type IpcMainInvokeEvent, type MenuItemConstructorOptions } from 'electron'
import { join } from 'node:path'
import { GRID_LAYOUTS, type AppConfig, type CameraPref, type GridLayout, type ViewPrefs } from '../shared/types'
import { hasToken, loadConfig, loadToken, saveConfig, saveToken } from './config'
import { installNetworkHooks, setHaAuth } from './network'
import { restoredBounds, trackWindowState } from './windowState'

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  const { maximized, ...bounds } = restoredBounds()
  const view = loadConfig().view
  mainWindow = new BrowserWindow({
    ...bounds,
    minWidth: 480,
    minHeight: 320,
    title: 'Visor HA',
    backgroundColor: '#0b0b0d',
    autoHideMenuBar: true,
    show: false,
    alwaysOnTop: view.alwaysOnTop,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })
  if (maximized) mainWindow.maximize()
  trackWindowState(mainWindow)

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
    if (view.startFullscreen) mainWindow?.setFullScreen(true)
  })

  mainWindow.webContents.on('will-navigate', (event) => event.preventDefault())

  if (process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow.on('closed', () => (mainWindow = null))
}

function setViewPrefs(patch: Partial<ViewPrefs>): void {
  const config = loadConfig()
  const view = { ...config.view, ...patch }
  saveConfig({ ...config, view })
  mainWindow?.setAlwaysOnTop(view.alwaysOnTop)
  mainWindow?.webContents.send('view:changed', view)
  buildMenu()
}

function toggleFullscreen(): void {
  if (mainWindow) mainWindow.setFullScreen(!mainWindow.isFullScreen())
}

function buildMenu(): void {
  const isMac = process.platform === 'darwin'
  const view = loadConfig().view
  const openSetup: MenuItemConstructorOptions = {
    label: 'Configuración…',
    accelerator: 'CmdOrCtrl+,',
    click: () => mainWindow?.webContents.send('nav:setup')
  }
  const layoutItems: MenuItemConstructorOptions[] = GRID_LAYOUTS.map(({ id, label }, i) => ({
    label,
    type: 'radio',
    checked: view.layout === id,
    accelerator: `CmdOrCtrl+${i}`,
    click: () => setViewPrefs({ layout: id as GridLayout })
  }))
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
        { label: 'Diseño de la grilla', submenu: layoutItems },
        { type: 'separator' },
        { label: 'Pantalla completa', accelerator: isMac ? 'Ctrl+Cmd+F' : 'F11', click: toggleFullscreen },
        // En Mac también funciona F11, sin mostrarlo dos veces en el menú.
        ...(isMac ? [{ label: 'Pantalla completa (F11)', accelerator: 'F11', visible: false, acceleratorWorksWhenHidden: true, click: toggleFullscreen }] : []),
        {
          label: 'Siempre visible',
          type: 'checkbox',
          checked: view.alwaysOnTop,
          click: (item) => setViewPrefs({ alwaysOnTop: item.checked })
        },
        {
          label: 'Arrancar en pantalla completa',
          type: 'checkbox',
          checked: view.startFullscreen,
          click: (item) => setViewPrefs({ startFullscreen: item.checked })
        },
        { type: 'separator' },
        { role: 'reload', label: 'Recargar' },
        { role: 'toggleDevTools', label: 'Herramientas de desarrollo' }
      ]
    }
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

/** Solo se atienden pedidos que vienen de la página principal de nuestra propia ventana. */
function isTrustedSender(event: IpcMainEvent | IpcMainInvokeEvent): boolean {
  return !!mainWindow && event.sender === mainWindow.webContents && event.senderFrame === mainWindow.webContents.mainFrame
}

function handle(channel: string, listener: (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown): void {
  ipcMain.handle(channel, (event, ...args) => {
    if (!isTrustedSender(event)) throw new Error('Pedido no autorizado')
    return listener(event, ...args)
  })
}

function registerIpc(): void {
  handle('config:get', (): AppConfig => {
    const { haUrl, cameras, view } = loadConfig()
    return { haUrl, cameras, view, hasToken: hasToken() }
  })
  handle('config:getToken', () => loadToken())
  handle('config:saveConnection', (_event, haUrl: unknown, token: unknown) => {
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
  handle('view:set', (_event, patch: unknown) => {
    if (!patch || typeof patch !== 'object') return
    const p = patch as Partial<ViewPrefs>
    const clean: Partial<ViewPrefs> = {}
    if (GRID_LAYOUTS.some((l) => l.id === p.layout)) clean.layout = p.layout
    if (typeof p.alwaysOnTop === 'boolean') clean.alwaysOnTop = p.alwaysOnTop
    if (typeof p.startFullscreen === 'boolean') clean.startFullscreen = p.startFullscreen
    setViewPrefs(clean)
  })
  ipcMain.on('window:exitFullscreen', (event) => {
    if (isTrustedSender(event) && mainWindow?.isFullScreen()) mainWindow.setFullScreen(false)
  })
  handle('config:saveCameras', (_event, cameras: unknown) => {
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
    // La app nunca necesita cámara, micrófono, ubicación ni notificaciones: se niega todo.
    session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false))
    session.defaultSession.setPermissionCheckHandler(() => false)
    registerIpc()
    buildMenu()
    createWindow()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  // Ninguna página puede abrir ventanas nuevas ni incrustar <webview>. Los links (por ejemplo,
  // "abrir mi perfil en HA") se abren en el navegador del sistema.
  app.on('web-contents-created', (_event, contents) => {
    contents.on('will-attach-webview', (event) => event.preventDefault())
    contents.setWindowOpenHandler(({ url }) => {
      if (/^https?:\/\//.test(url)) void shell.openExternal(url)
      return { action: 'deny' }
    })
  })

  app.on('window-all-closed', () => app.quit())
}
