import { GRID_LAYOUTS, type CameraPref, type GridLayout, type ViewPrefs } from '@shared/types'
import { useEffect } from 'preact/hooks'
import type { Credentials, HaSession } from '../ha/useHaConnection'
import { CameraList } from './CameraList'
import { ConnectionForm } from './ConnectionForm'

interface Props {
  creds: Credentials | null
  ha: HaSession
  prefs: CameraPref[] | null
  view: ViewPrefs
  onSavedConnection(creds: Credentials): void
  onPrefsChange(prefs: CameraPref[]): void
  /** Ausente mientras todavía no hay una conexión guardada. */
  onClose?: () => void
}

export function Settings({ creds, ha, prefs, view, onSavedConnection, onPrefsChange, onClose }: Props) {
  useEffect(() => {
    if (!onClose) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div class="settings">
      <div class="settings-inner">
        <header class="settings-header">
          <h1>{creds ? 'Configuración' : 'Conectar con Home Assistant'}</h1>
          {onClose && <button onClick={onClose}>Ver cámaras</button>}
        </header>

        {creds && (
          <section class="card">
            <h2>Cámaras</h2>
            <CameraList ha={ha} prefs={prefs} onChange={onPrefsChange} />
          </section>
        )}
        {creds && (
          <section class="card">
            <h2>Pantalla</h2>
            <div class="form">
              <label>
                Diseño de la grilla
                <select
                  value={view.layout}
                  onChange={(e) => void window.visor.setViewPrefs({ layout: e.currentTarget.value as GridLayout })}
                >
                  {GRID_LAYOUTS.map(({ id, label }) => (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  ))}
                </select>
                <small>
                  Con un diseño fijo, si hay más cámaras que lugares se pasa de página con las flechas ← →.
                  También se cambia desde la grilla o con Cmd/Ctrl + 0 a 4.
                </small>
              </label>
              <label class="check">
                <input
                  type="checkbox"
                  checked={view.alwaysOnTop}
                  onChange={(e) => void window.visor.setViewPrefs({ alwaysOnTop: e.currentTarget.checked })}
                />
                Siempre visible (la ventana queda por encima de las demás)
              </label>
              <label class="check">
                <input
                  type="checkbox"
                  checked={view.startFullscreen}
                  onChange={(e) => void window.visor.setViewPrefs({ startFullscreen: e.currentTarget.checked })}
                />
                Arrancar en pantalla completa
              </label>
              <small>Pantalla completa: F11 (en Mac también Ctrl + Cmd + F). Esc para salir.</small>
            </div>
          </section>
        )}
        <section class="card">
          {creds && <h2>Conexión con Home Assistant</h2>}
          <ConnectionForm
            initialUrl={creds?.haUrl ?? ''}
            hasStoredToken={creds !== null}
            onSaved={(haUrl, token) => onSavedConnection({ haUrl, token })}
          />
        </section>

      </div>
    </div>
  )
}
