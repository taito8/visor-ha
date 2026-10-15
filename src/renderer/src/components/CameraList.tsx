import type { CameraPref } from '@shared/types'
import { useState } from 'preact/hooks'
import { mergeCameraPrefs, prefsFromEntries, type CameraEntry } from '../ha/cameras'
import type { HaSession } from '../ha/useHaConnection'

interface Props {
  ha: HaSession
  prefs: CameraPref[] | null
  onChange(prefs: CameraPref[]): void
}

/** Lista de cámaras de HA: mostrar/ocultar, renombrar y ordenar (arrastrando o con flechas). */
export function CameraList({ ha, prefs, onChange }: Props) {
  // La fila solo es arrastrable mientras se mantiene apretada la manija, así los campos de texto siguen andando normal.
  const [armed, setArmed] = useState<number | null>(null)
  const [dragFrom, setDragFrom] = useState<number | null>(null)
  const [dropAt, setDropAt] = useState<number | null>(null)

  if (!ha.cameras) {
    return <p class="muted">{ha.state.kind === 'error' ? ha.state.message : 'Cargando cámaras…'}</p>
  }
  if (ha.cameras.length === 0) {
    return <p class="muted">Home Assistant no tiene entidades <code>camera.*</code>.</p>
  }

  const entries = mergeCameraPrefs(ha.cameras, prefs)
  const commit = (next: CameraEntry[]) => onChange(prefsFromEntries(next, prefs))
  const update = (index: number, patch: Partial<CameraPref>) =>
    commit(entries.map((e, i) => (i === index ? { ...e, pref: { ...e.pref, ...patch } } : e)))
  /** Mueve la fila `from` para que quede antes de la posición `to` (0…cantidad). */
  const move = (from: number, to: number) => {
    const next = [...entries]
    const [item] = next.splice(from, 1)
    next.splice(to > from ? to - 1 : to, 0, item)
    commit(next)
  }
  const resetDrag = () => {
    setArmed(null)
    setDragFrom(null)
    setDropAt(null)
  }

  return (
    <>
      <p class="muted">
        Marcá las que querés ver. Podés cambiarles el nombre y ordenarlas arrastrando desde <span class="handle-hint">⠿</span>.
        El código gris (<code>camera.…</code>) sirve para distinguir cámaras repetidas.
      </p>
      <ul class="camera-list">
        {entries.map((e, i) => {
          const classes = ['camera-row']
          if (!e.pref.enabled) classes.push('disabled')
          if (dragFrom === i) classes.push('dragging')
          if (dropAt === i && dragFrom !== null) classes.push('drop-before')
          if (dropAt === i + 1 && i === entries.length - 1 && dragFrom !== null) classes.push('drop-after')
          return (
            <li
              key={e.cam.entityId}
              class={classes.join(' ')}
              draggable={armed === i}
              onDragStart={(ev) => {
                setDragFrom(i)
                ev.dataTransfer?.setData('text/plain', e.cam.entityId)
                if (ev.dataTransfer) ev.dataTransfer.effectAllowed = 'move'
              }}
              onDragOver={(ev) => {
                if (dragFrom === null) return
                ev.preventDefault()
                const rect = ev.currentTarget.getBoundingClientRect()
                setDropAt(ev.clientY < rect.top + rect.height / 2 ? i : i + 1)
              }}
              onDrop={(ev) => {
                ev.preventDefault()
                if (dragFrom !== null && dropAt !== null) move(dragFrom, dropAt)
                resetDrag()
              }}
              onDragEnd={resetDrag}
            >
              <span class="handle" title="Arrastrar para ordenar" onMouseDown={() => setArmed(i)} onMouseUp={() => setArmed(null)}>
                ⠿
              </span>
              <input
                type="checkbox"
                title="Mostrar en la grilla"
                checked={e.pref.enabled}
                onChange={(ev) => update(i, { enabled: ev.currentTarget.checked })}
              />
              <div class="camera-text">
                <input
                  class="camera-name"
                  type="text"
                  value={e.pref.name ?? ''}
                  placeholder={e.cam.name}
                  spellcheck={false}
                  onInput={(ev) => update(i, { name: ev.currentTarget.value })}
                />
                <span class="camera-id">
                  <code>{e.cam.entityId}</code>
                  {!e.cam.available && <span class="tag">no disponible</span>}
                </span>
              </div>
              <span class="arrows">
                <button type="button" class="icon" title="Subir" disabled={i === 0} onClick={() => move(i, i - 1)}>
                  ↑
                </button>
                <button type="button" class="icon" title="Bajar" disabled={i === entries.length - 1} onClick={() => move(i, i + 2)}>
                  ↓
                </button>
              </span>
            </li>
          )
        })}
      </ul>
    </>
  )
}
