import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import type { ViewPrefs, VisorApi } from '../shared/types'

const api: VisorApi = {
  getConfig: () => ipcRenderer.invoke('config:get'),
  getToken: () => ipcRenderer.invoke('config:getToken'),
  saveConnection: (haUrl, token) => ipcRenderer.invoke('config:saveConnection', haUrl, token),
  saveCameras: (cameras) => ipcRenderer.invoke('config:saveCameras', cameras),
  setViewPrefs: (patch) => ipcRenderer.invoke('view:set', patch),
  onViewPrefs: (cb) => {
    const listener = (_event: IpcRendererEvent, prefs: ViewPrefs) => cb(prefs)
    ipcRenderer.on('view:changed', listener)
    return () => ipcRenderer.removeListener('view:changed', listener)
  },
  exitFullscreen: () => ipcRenderer.send('window:exitFullscreen'),
  onOpenSetup: (cb) => {
    const listener = () => cb()
    ipcRenderer.on('nav:setup', listener)
    return () => ipcRenderer.removeListener('nav:setup', listener)
  }
}

contextBridge.exposeInMainWorld('visor', api)
