import { getStates } from 'home-assistant-js-websocket'
import { useState } from 'preact/hooks'
import { connectHA, HaError, normalizeUrl } from '../ha/connection'

interface Props {
  initialUrl: string
  /** Si ya hay un token guardado, el campo puede quedar vacío para conservarlo. */
  hasStoredToken: boolean
  onSaved(haUrl: string, token: string): void
}

type Result = { ok: boolean; message: string } | null

export function ConnectionForm({ initialUrl, hasStoredToken, onSaved }: Props) {
  const [url, setUrl] = useState(initialUrl)
  const [token, setToken] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<Result>(null)

  let profileUrl: string | null = null
  try {
    profileUrl = url.trim() ? `${normalizeUrl(url)}/profile/security` : null
  } catch {
    profileUrl = null
  }

  /** Prueba la conexión y devuelve URL y token listos para guardar, o null si falló. */
  async function test(): Promise<{ haUrl: string; token: string } | null> {
    setBusy(true)
    setResult(null)
    try {
      const haUrl = normalizeUrl(url)
      const finalToken = token.trim() || (hasStoredToken ? await window.visor.getToken() : null)
      if (!finalToken) throw new HaError('auth', 'Pegá el token de acceso de larga duración.')
      const conn = await connectHA(haUrl, finalToken)
      try {
        const states = await getStates(conn)
        const cameras = states.filter((s) => s.entity_id.startsWith('camera.')).length
        setResult({
          ok: true,
          message: `Conexión correcta con Home Assistant ${conn.haVersion}. ${cameras === 1 ? 'Se encontró 1 cámara' : `Se encontraron ${cameras} cámaras`}.`
        })
      } finally {
        conn.close()
      }
      return { haUrl, token: finalToken }
    } catch (err) {
      setResult({ ok: false, message: err instanceof Error ? err.message : String(err) })
      return null
    } finally {
      setBusy(false)
    }
  }

  async function save(event: Event) {
    event.preventDefault()
    const ok = await test()
    if (!ok) return
    try {
      await window.visor.saveConnection(ok.haUrl, ok.token)
      onSaved(ok.haUrl, ok.token)
    } catch (err) {
      setResult({ ok: false, message: `No se pudo guardar la configuración: ${err instanceof Error ? err.message : String(err)}` })
    }
  }

  return (
    <form class="form" onSubmit={save}>
      <label>
        Dirección de Home Assistant
        <input
          type="text"
          value={url}
          placeholder="http://192.168.1.50:8123"
          autoFocus={!initialUrl}
          spellcheck={false}
          onInput={(e) => setUrl(e.currentTarget.value)}
        />
        <small>La misma que usás en el navegador. Puede ser local (http://192.168.x.x:8123) o remota (https://…).</small>
      </label>

      <label>
        Token de acceso de larga duración
        <input
          type="password"
          value={token}
          placeholder={hasStoredToken ? 'Guardado. Dejalo vacío para mantenerlo.' : 'Pegá el token acá'}
          spellcheck={false}
          onInput={(e) => setToken(e.currentTarget.value)}
        />
      </label>

      <details class="help">
        <summary>¿Cómo creo el token?</summary>
        <ol>
          <li>Abrí Home Assistant en el navegador e iniciá sesión.</li>
          <li>
            Hacé clic en tu nombre de usuario (abajo a la izquierda) → pestaña <b>Seguridad</b>
            {profileUrl && (
              <>
                {' '}(<a href={profileUrl} target="_blank" rel="noreferrer">abrirla ahora</a>)
              </>
            )}
            .
          </li>
          <li>Al final de la página, en <b>Tokens de acceso de larga duración</b>, tocá <b>Crear token</b>.</li>
          <li>Poné un nombre (por ejemplo, "Visor HA"), copiá el token y pegalo acá. HA lo muestra una sola vez.</li>
        </ol>
      </details>

      {result && <p class={result.ok ? 'result ok' : 'result error'}>{result.message}</p>}

      <div class="actions">
        <button type="button" class="secondary" onClick={() => void test()} disabled={busy}>
          {busy ? 'Probando…' : 'Probar conexión'}
        </button>
        <button type="submit" disabled={busy}>
          Guardar y conectar
        </button>
      </div>
    </form>
  )
}
