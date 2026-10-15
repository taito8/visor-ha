# Visor HA

Visor HA es una aplicación para **Mac** y **Windows** que muestra en vivo, en una grilla, las cámaras que ya tenés configuradas en tu **Home Assistant**. Es un NVR en vivo: no graba nada; muestra lo que están viendo tus cámaras en este momento.

- Muestra todas tus cámaras en una grilla que se acomoda sola, o en diseños fijos (1, 2×2, 3×3, 1 grande + 5 chicas).
- Usa el método de video más rápido que tenga cada cámara (WebRTC, HLS o MJPEG) y cambia solo a otro si alguno falla.
- Si se corta la conexión, se reconecta sola.
- Con doble clic en una cámara la ves en grande; pantalla completa con F11.
- No hace falta tocar la configuración de Home Assistant.

---

## Qué necesitás

- **Home Assistant** con tus cámaras ya funcionando (que se vean en el panel de HA).
  - Con **Home Assistant 2024.11 o posterior** se usa WebRTC: casi sin atraso.
  - Con versiones anteriores la app funciona igual, pero con 2 a 5 segundos de atraso.
- Una computadora con:
  - **Mac:** macOS 12 (Monterey) o posterior. Sirve para Mac con chip Intel o Apple (M1, M2, etc.).
  - **Windows:** Windows 10 u 11 de 64 bits.
- Que esa computadora pueda llegar a tu Home Assistant: estando en la misma red de tu casa o con acceso remoto (Tailscale, Nabu Casa, etc.).
  - Una prueba simple: si en esa computadora abrís la dirección de tu HA en el navegador y carga, la app también va a poder conectarse.

---

## Paso 1: crear un token de acceso en Home Assistant

El token es una "llave" que le permite a la app ver tus cámaras sin guardar tu contraseña.

1. Abrí Home Assistant en el navegador e iniciá sesión.
2. Abajo a la izquierda, hacé clic en **tu nombre de usuario** (abre tu perfil).
3. Arriba, entrá a la pestaña **Seguridad**.
4. Bajá hasta el final, a **Tokens de acceso de larga duración**, y tocá **Crear token**.
5. Poné un nombre que te sirva para reconocerlo, por ejemplo `Visor HA`, y tocá **Aceptar**.
6. **Copiá el token** (es un texto largo) y guardalo a mano por un momento: Home Assistant lo muestra **una sola vez**.

> Si lo perdiste, no pasa nada: borrá ese token y creá uno nuevo.

---

## Paso 2: instalar la app

Descargá el instalador desde la sección **Releases** de la página del proyecto en GitHub:

- **Mac:** `Visor-HA-<versión>-mac.dmg`
- **Windows:** `Visor-HA-<versión>-windows.exe`

La app **no está firmada** con un certificado de Apple ni de Microsoft (cuestan dinero). Por eso, la primera vez el sistema avisa que no puede verificarla. Es normal: estos son los pasos para abrirla igual.

### En Mac

1. Abrí el archivo `.dmg` y **arrastrá "Visor HA" a la carpeta Aplicaciones**.
2. Abrí **Visor HA** desde Aplicaciones. Va a aparecer un aviso de que no se puede verificar. Tocá **Aceptar** (o **Listo**).
3. Andá a **Ajustes del Sistema → Privacidad y seguridad**.
4. Bajá hasta la sección **Seguridad**. Vas a ver un mensaje que dice que se bloqueó "Visor HA". Tocá **Abrir igualmente** y confirmá con tu contraseña o con Touch ID.
5. Listo: desde ahora abre normalmente.

> **En macOS 14 (Sonoma) o anterior** hay un camino más corto: en Aplicaciones, hacé **clic derecho sobre Visor HA → Abrir**, y en el aviso tocá **Abrir**.

Además, la primera vez que la uses, macOS puede mostrar dos preguntas más:

- **"Visor HA quiere encontrar dispositivos en tu red local"**: tocá **Permitir**. Sin este permiso, la app no puede llegar a un Home Assistant de tu casa.
- **"Visor HA quiere usar información confidencial guardada en el llavero"**: ingresá tu contraseña y tocá **Permitir siempre**. Ahí es donde la app guarda el token, cifrado. Puede volver a aparecer después de instalar una versión nueva.

> **Si el Mac dice que la app "está dañada y no se puede abrir":** abrí la app **Terminal**, pegá este comando, apretá Enter y volvé a abrir la app:
>
> ```bash
> xattr -cr "/Applications/Visor HA.app"
> ```

### En Windows

1. Abrí el archivo `Visor-HA-<versión>-windows.exe`.
2. Va a aparecer una ventana azul que dice **"Windows protegió su PC"**. Hacé clic en **Más información** y después en **Ejecutar de todos modos**.
3. La app se instala sola (no pide nada más) y queda un acceso directo en el escritorio y en el menú Inicio.

---

## Paso 3: conectarse a Home Assistant

La primera vez que abrís la app aparece la pantalla **Conectar con Home Assistant**:

1. En **Dirección de Home Assistant**, escribí la misma dirección que usás en el navegador. Por ejemplo:
   - En tu casa: `http://192.168.1.50:8123`
   - Desde afuera (Tailscale, Nabu Casa, etc.): `https://mi-casa.ts.net` o la dirección que corresponda
2. En **Token de acceso de larga duración**, pegá el token del paso 1.
3. Tocá **Probar conexión**. Si está todo bien vas a ver algo como *"Conexión correcta con Home Assistant 2026.10. Se encontraron 3 cámaras."*
4. Tocá **Guardar y conectar**.
5. Aparece la lista de **Cámaras**. Marcá las que querés ver y, si querés, cambiales el nombre y ordenalas (arrastrando desde ⠿ o con las flechas).
6. Tocá **Ver cámaras**.

> **Cámaras repetidas:** es común que una misma cámara aparezca dos o más veces, por ejemplo una vía ONVIF y otra vía Frigate, o una en alta calidad y otra en baja. Para distinguirlas, debajo de cada nombre está su código (`camera.…`). Dejá marcada la que mejor se vea.

---

## Cómo se usa

Al mover el mouse aparece una barra abajo a la derecha para elegir el diseño de la grilla y abrir la configuración. Se esconde sola a los pocos segundos.

| Para… | Hacé esto |
|---|---|
| Ver una cámara en grande | Doble clic sobre la cámara |
| Volver a la grilla | Doble clic otra vez, o **Esc** |
| Pantalla completa | **F11** (en Mac también **Ctrl + Cmd + F**) · **Esc** para salir |
| Cambiar el diseño de la grilla | La barra de abajo, o **Cmd/Ctrl + 0** (automático) a **4** (1 grande + 5 chicas) |
| Pasar de página (diseños fijos con muchas cámaras) | Flechas **← →** o los botones ‹ › de los costados |
| Abrir la configuración | **Cmd/Ctrl + ,** o el botón ⚙ |
| Ventana siempre encima de las demás | Menú **Ver → Siempre visible** |
| Que abra directo en pantalla completa | Menú **Ver → Arrancar en pantalla completa** |

En la esquina de cada cámara se ve su nombre y la hora. Arriba a la derecha, un cartelito indica el método de video en uso:

- **WebRTC**: el mejor, casi sin atraso.
- **HLS**: 2 a 5 segundos de atraso.
- **MJPEG**: último recurso, menos fluido.

La app elige sola el mejor método que funcione. Los videos se muestran **sin sonido**.

La app recuerda el tamaño y la posición de la ventana, el diseño elegido y el orden de las cámaras.

---

## Problemas comunes

**"No se pudo conectar con …"**
- Revisá la dirección: tiene que empezar con `http://` o `https://` e incluir el puerto si lo usás (normalmente `:8123` en la red local). Copiala tal cual de la barra del navegador.
- Probá abrir esa dirección en el navegador **de la misma computadora**. Si tampoco carga, la computadora no está llegando a Home Assistant: fijate que esté en la misma red Wi-Fi, o que Tailscale (o el acceso remoto que uses) esté encendido.
- En Mac, revisá que la app tenga permiso de red local: **Ajustes del Sistema → Privacidad y seguridad → Red local → Visor HA** activado.

**"Home Assistant rechazó el token"**
- Puede que el token esté incompleto (copialo de nuevo) o que se haya borrado en HA. Creá uno nuevo (paso 1) y pegalo en **Configuración**.

**Una cámara dice "Reconectando…" y no arranca nunca**
- Fijate si esa cámara se ve en vivo dentro del propio Home Assistant. Si allá tampoco anda, el problema está entre HA y la cámara, no en la app.
- Si la cámara es ONVIF, probá con otra de sus entidades (por ejemplo la que termina en `profile_1`, que suele ser más liviana). Si aparece deshabilitada, habilitala en HA: **Ajustes → Dispositivos y servicios → ONVIF →** el dispositivo de la cámara **→** la entidad **→ ⚙ → Habilitada**.
- El texto chiquito debajo de "Reconectando…" dice el motivo, por ejemplo *"HA no entregó el video"*.

**"Cámara no disponible"**
- Home Assistant marca esa cámara como no disponible (apagada, sin red, etc.). Cuando vuelva en HA, vuelve sola en la app.

**La imagen de una cámara se ve en baja calidad**
- La app muestra el video tal cual lo entrega Home Assistant. Si esa cámara tiene otra entidad (stream principal y secundario), elegí la de mejor calidad en **Configuración → Cámaras**. El stream principal pesa más: si desde afuera de tu casa se traba, usá el secundario.

**Desde afuera de casa las cámaras dicen "HLS" en lugar de "WebRTC"**
- Es normal en algunos accesos remotos: WebRTC no logra conectar por esa red y la app pasa sola a HLS. Se ve igual, con un par de segundos más de atraso.

**Uso un certificado HTTPS propio (autofirmado)**
- La app no acepta certificados autofirmados. Usá la dirección `http://` local, o un acceso remoto con certificado válido (Tailscale con HTTPS, Nabu Casa, etc.).

**Quiero empezar de cero**
- Abrí **Configuración** para cambiar el servidor, el token o las cámaras. Si preferís borrar todo, cerrá la app y borrá esta carpeta:
  - Mac: `~/Library/Application Support/Visor HA`
  - Windows: `%APPDATA%\Visor HA`

---

## Para quien mantiene la app

> Esta parte es técnica; para usar la app no hace falta.

**Tecnologías:** Electron + TypeScript, interfaz en Preact, empaquetado con electron-builder. La conexión con Home Assistant usa `home-assistant-js-websocket`, y el video usa WebRTC con el go2rtc integrado de HA, HLS con hls.js, o MJPEG.

**Correr en modo desarrollo** (necesita Node.js 22 o posterior):

```bash
npm install
npm run dev
```

**Compilar los instaladores en la propia computadora:** `npm run dist:mac` (solo desde una Mac) o `npm run dist:win` (desde Windows). Quedan en la carpeta `dist/`.

**Publicar una versión nueva** (compila Mac y Windows en GitHub, sin necesitar las dos computadoras):

1. Subí el proyecto a un repositorio de GitHub (una sola vez).
2. Creá y subí un tag con el número de versión:
   ```bash
   git tag v0.2.0
   git push origin v0.2.0
   ```
3. En la pestaña **Actions** del repositorio vas a ver la compilación (tarda unos 10 minutos). Al terminar, los instaladores quedan publicados en **Releases**.

**Estructura:**

| Carpeta | Contenido |
|---|---|
| `src/main/` | Proceso principal: ventana, menú, configuración, token cifrado con `safeStorage` y solución de CORS |
| `src/preload/` | Puente seguro entre el proceso principal y la interfaz |
| `src/renderer/src/` | Interfaz: conexión con HA, grilla, configuración y reproductores de video (`streams/`) |
| `.github/workflows/release.yml` | Compilación automática de los instaladores |

La configuración se guarda en `config.json` y el token, cifrado, en `token.enc`, ambos dentro de la carpeta de datos del usuario.
