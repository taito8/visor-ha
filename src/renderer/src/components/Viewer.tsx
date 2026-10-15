import { GRID_LAYOUTS, type CameraPref, type GridLayout } from '@shared/types'
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks'
import { mergeCameraPrefs } from '../ha/cameras'
import type { HaSession } from '../ha/useHaConnection'
import { Tile } from './Tile'

interface Props {
  ha: HaSession
  haUrl: string
  prefs: CameraPref[] | null
  layout: GridLayout
  onOpenSettings(): void
}

const ASPECT = 16 / 9

/** Cámaras por página en los diseños fijos, y su grilla (columnas × filas). */
const FIXED_LAYOUTS: Record<Exclude<GridLayout, 'auto'>, { size: number; cols: number; rows: number }> = {
  single: { size: 1, cols: 1, rows: 1 },
  '2x2': { size: 4, cols: 2, rows: 2 },
  '3x3': { size: 9, cols: 3, rows: 3 },
  '1+5': { size: 6, cols: 3, rows: 3 }
}

const LAYOUT_SHORT: Record<GridLayout, string> = { auto: 'Auto', single: '1', '2x2': '2×2', '3x3': '3×3', '1+5': '1+5' }

/** Cuánto tiempo sin mover el mouse hasta esconder los controles (y el cursor). */
const IDLE_MS = 2500

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

/** true mientras el mouse se movió hace poco. */
function useMouseActive(): boolean {
  const [active, setActive] = useState(true)
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const onMove = () => {
      setActive(true)
      clearTimeout(timer)
      timer = setTimeout(() => setActive(false), IDLE_MS)
    }
    onMove()
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mousedown', onMove)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mousedown', onMove)
    }
  }, [])
  return active
}

export function Viewer({ ha, haUrl, prefs, layout, onOpenSettings }: Props) {
  const { conn, state, generation, cameras } = ha
  const gridRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 1280, height: 720 })
  /** Cámara ampliada a toda la ventana (doble clic), o null para ver la grilla. */
  const [focused, setFocused] = useState<string | null>(null)

  const [page, setPage] = useState(0)
  const mouseActive = useMouseActive()

  const entries = cameras ? mergeCameraPrefs(cameras, prefs).filter((e) => e.pref.enabled) : []
  const fixed = layout === 'auto' ? null : FIXED_LAYOUTS[layout]
  const pageCount = fixed ? Math.max(1, Math.ceil(entries.length / fixed.size)) : 1
  const currentPage = Math.min(page, pageCount - 1)
  const visible = fixed ? entries.slice(currentPage * fixed.size, (currentPage + 1) * fixed.size) : entries
  const focusedVisible = focused !== null && visible.some((e) => e.cam.entityId === focused)
  const changePage = (delta: number) => setPage((currentPage + delta + pageCount) % pageCount)

  useEffect(() => setPage(0), [layout])

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
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Esc primero vuelve de la cámara ampliada; si no hay ninguna, sale de pantalla completa.
        if (focusedVisible) setFocused(null)
        else window.visor.exitFullscreen()
      } else if (!focusedVisible && pageCount > 1 && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
        changePage(e.key === 'ArrowRight' ? 1 : -1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [focusedVisible, pageCount, currentPage])

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

  const cols = fixed ? fixed.cols : bestColumns(entries.length, size.width, size.height)
  const rows = fixed ? fixed.rows : Math.ceil(entries.length / cols)

  return (
    <div class={mouseActive ? 'viewer controls-visible' : 'viewer'}>
      <div
        class={layout === '1+5' ? 'grid layout-big' : 'grid'}
        ref={gridRef}
        style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: `repeat(${rows}, 1fr)` }}
      >
        {visible.map((e) => (
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
      {pageCount > 1 && !focusedVisible && (
        <>
          <button class="page-button prev" title="Página anterior (←)" onClick={() => changePage(-1)}>
            ‹
          </button>
          <button class="page-button next" title="Página siguiente (→)" onClick={() => changePage(1)}>
            ›
          </button>
        </>
      )}
      <div class="toolbar">
        {pageCount > 1 && (
          <span class="page-indicator">
            {currentPage + 1}/{pageCount}
          </span>
        )}
        <div class="layout-picker" role="radiogroup" aria-label="Diseño de la grilla">
          {GRID_LAYOUTS.map(({ id, label }, i) => (
            <button
              key={id}
              class={layout === id ? 'active' : ''}
              title={`${label} (Cmd/Ctrl + ${i})`}
              aria-checked={layout === id}
              role="radio"
              onClick={() => void window.visor.setViewPrefs({ layout: id })}
            >
              {LAYOUT_SHORT[id]}
            </button>
          ))}
        </div>
        <button class="settings-button" title="Configuración (Cmd/Ctrl + ,)" onClick={onOpenSettings}>
          ⚙
        </button>
      </div>
    </div>
  )
}
