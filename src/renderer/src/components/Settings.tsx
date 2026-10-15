import type { CameraPref } from '@shared/types'
import { useEffect } from 'preact/hooks'
import type { Credentials, HaSession } from '../ha/useHaConnection'
import { CameraList } from './CameraList'
import { ConnectionForm } from './ConnectionForm'

interface Props {
  creds: Credentials | null
  ha: HaSession
  prefs: CameraPref[] | null
  onSavedConnection(creds: Credentials): void
  onPrefsChange(prefs: CameraPref[]): void
  /** Ausente mientras todavía no hay una conexión guardada. */
  onClose?: () => void
}

export function Settings({ creds, ha, prefs, onSavedConnection, onPrefsChange, onClose }: Props) {
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
