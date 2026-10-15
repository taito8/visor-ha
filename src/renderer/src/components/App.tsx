import type { CameraPref, ViewPrefs } from '@shared/types'
import { useEffect, useState } from 'preact/hooks'
import { useHaConnection, type Credentials } from '../ha/useHaConnection'
import { Settings } from './Settings'
import { Viewer } from './Viewer'

export function App() {
  const [loaded, setLoaded] = useState(false)
  const [creds, setCreds] = useState<Credentials | null>(null)
  const [prefs, setPrefs] = useState<CameraPref[] | null>(null)
  const [view, setView] = useState<ViewPrefs>({ layout: 'auto', alwaysOnTop: false, startFullscreen: false })
  const [settingsOpen, setSettingsOpen] = useState(false)
  const ha = useHaConnection(creds)

  useEffect(() => {
    void (async () => {
      const config = await window.visor.getConfig()
      const token = config.haUrl && config.hasToken ? await window.visor.getToken() : null
      if (config.haUrl && token) setCreds({ haUrl: config.haUrl, token })
      setPrefs(config.cameras)
      setView(config.view)
      setLoaded(true)
    })()
  }, [])

  useEffect(() => window.visor.onOpenSetup(() => setSettingsOpen(true)), [])
  useEffect(() => window.visor.onViewPrefs(setView), [])

  if (!loaded) return null

  if (!creds || settingsOpen) {
    return (
      <Settings
        creds={creds}
        ha={ha}
        prefs={prefs}
        view={view}
        onSavedConnection={(next) => {
          if (next.haUrl !== creds?.haUrl) setPrefs(null)
          setCreds(next)
          // Después de conectar por primera vez queda abierta la configuración para elegir cámaras.
          setSettingsOpen(true)
        }}
        onPrefsChange={(next) => {
          setPrefs(next)
          void window.visor.saveCameras(next)
        }}
        onClose={creds ? () => setSettingsOpen(false) : undefined}
      />
    )
  }

  return <Viewer ha={ha} haUrl={creds.haUrl} prefs={prefs} layout={view.layout} onOpenSettings={() => setSettingsOpen(true)} />
}
