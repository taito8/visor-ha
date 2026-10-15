import { contextBridge, ipcRenderer } from 'electron'
import type { VisorApi } from '../shared/types'

const api: VisorApi = {
  getConfig: () => ipcRenderer.invoke('config:get'),
  getToken: () => ipcRenderer.invoke('config:getToken'),
  saveConnection: (haUrl, token) => ipcRenderer.invoke('config:saveConnection', haUrl, token),
  saveCameras: (cameras) => ipcRenderer.invoke('config:saveCameras', cameras),
  onOpenSetup: (cb) => {
    const listener = () => cb()
    ipcRenderer.on('nav:setup', listener)
    return () => ipcRenderer.removeListener('nav:setup', listener)
  }
}

contextBridge.exposeInMainWorld('visor', api)
