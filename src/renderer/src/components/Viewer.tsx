import type { CameraPref } from '@shared/types'
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks'
import { mergeCameraPrefs } from '../ha/cameras'
import type { HaSession } from '../ha/useHaConnection'
import { Tile } from './Tile'

interface Props {
  ha: HaSession
  haUrl: string
  prefs: CameraPref[] | null
  onOpenSettings(): void
}

const ASPECT = 16 / 9

/** Elige la cantidad de columnas que deja los tiles 16:9 más grandes posibles en el espacio disponible. */
function bestColumns(count: number, width: number, height: number): number {
  let best = 1
  let bestArea = 0
  for (let cols = 1; cols <= count; cols++) {
    const rows = Math.ceil(count / cols)
    const tileW = Math.min(width / cols, (height / rows) * ASPECT)
    const area = tileW * (tileW / ASPECT)
    if (area > bestArea + 1) {
      bestArea = area
      best = cols
    }
  }
  return best
}

export function Viewer({ ha, haUrl, prefs, onOpenSettings }: Props) {
  const { conn, state, generation, cameras } = ha
  const gridRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 1280, height: 720 })
  /** Cámara ampliada a toda la ventana (doble clic), o null para ver la grilla. */
  const [focused, setFocused] = useState<string | null>(null)

  const entries = cameras ? mergeCameraPrefs(cameras, prefs).filter((e) => e.pref.enabled) : []
  const focusedVisible = focused !== null && entries.some((e) => e.cam.entityId === focused)

  useLayoutEffect(() => {
    const el = gridRef.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => {
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height })
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [conn, entries.length > 0])

  useEffect(() => {
    if (!focusedVisible) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFocused(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [focusedVisible])

  if (!conn || !cameras) {
    return (
      <div class="message-screen">
        {state.kind === 'error' ? (
          <>
            <p class="error">{state.message}</p>
            {state.retrying && <p class="muted">Reintentando en unos segundos…</p>}
            <button onClick={onOpenSettings}>Abrir configuración</button>
          </>
        ) : (
          <p class="muted">Conectando con Home Assistant…</p>
        )}
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <div class="message-screen">
        {cameras.length === 0 ? (
          <>
            <p>No se encontraron cámaras en Home Assistant.</p>
            <p class="muted">Revisá que tus cámaras aparezcan como entidades <code>camera.*</code>.</p>
          </>
        ) : (
          <p>No hay cámaras seleccionadas para mostrar.</p>
        )}
        <button onClick={onOpenSettings}>Abrir configuración</button>
      </div>
    )
  }

  const cols = bestColumns(entries.length, size.width, size.height)
  const rows = Math.ceil(entries.length / cols)

  return (
    <div class="viewer">
      <div
        class="grid"
        ref={gridRef}
        style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: `repeat(${rows}, 1fr)` }}
      >
        {entries.map((e) => (
          <Tile
            key={`${e.cam.entityId}#${generation}`}
            cam={e.cam}
            name={e.displayName}
            conn={conn}
            haUrl={haUrl}
            focused={focusedVisible && focused === e.cam.entityId}
            onDoubleClick={() => setFocused((f) => (f === e.cam.entityId ? null : e.cam.entityId))}
          />
        ))}
      </div>
      {state.kind === 'lost' && <div class="banner">Se perdió la conexión con Home Assistant. Reconectando…</div>}
      {state.kind === 'error' && <div class="banner error">{state.message}</div>}
      <button class="settings-button" title="Configuración (Cmd/Ctrl + ,)" onClick={onOpenSettings}>
        ⚙
      </button>
    </div>
  )
}
